import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as amplify from '@aws-cdk/aws-amplify-alpha';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { IAWSAmplifyStackProps } from '../bin/types';
import { NagSuppressions } from 'cdk-nag';
import { DateTimeAttribute, UserPool, VerificationEmailStyle } from 'aws-cdk-lib/aws-cognito';
import { CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { RedirectStatus } from '@aws-cdk/aws-amplify-alpha';

export class AwsAmplifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: IAWSAmplifyStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, 'AmplifyRole', {
      roleName: props.roleName,
      description: props.roleDesc,
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'));

    // get github token from secret manager
    const secret = secretsmanager.Secret.fromSecretNameV2(this, 'githubSecret', props.secretName);
    secret.grantRead(role);

    // setting up cognito pool for authentication of app
    const userPool = new UserPool(this, 'aletha-userpool', {
      userPoolName: 'aletha-userpool',
      removalPolicy: RemovalPolicy.DESTROY,
      signInAliases: {
          email: true
      },
      selfSignUpEnabled: true,
      autoVerify: {
          email: true
      },
      userVerification: {
          emailSubject: 'Please verify your email.',
          emailBody: 'Thanks for registration! Your code is {####}',
          emailStyle: VerificationEmailStyle.CODE
      },
      standardAttributes: {
          email: {
              required: true,
              mutable: true
          },
          familyName: {
              required: true,
              mutable: false
          }
      },
      customAttributes: {
          created_at: new DateTimeAttribute()
      }
  });

  const userPoolClient = userPool.addClient('aletha-userpool-client', {
      userPoolClientName: 'aletha-userpool-client',
      generateSecret: false,
      authFlows: {
          userSrp: true,
          userPassword: true
      }
  });

  userPool.addDomain('alethadomain', {
      cognitoDomain: {
          domainPrefix: 'alethadomain'
      }
  });

  new CfnOutput(this, 'COGNITO_ID', {
      value: userPool.userPoolId
  });

  new CfnOutput(this, 'COGNITO_CLIENT_ID', {
      value: userPoolClient.userPoolClientId
  });

    // buildspecs for next.js static website
    const buildSpec = codebuild.BuildSpec.fromObjectToYaml({
      version: '1.0',
      frontend: {
          phases: {
            preBuild: { commands: ['npm ci'] },
            build: {
              commands: [
                'npm run build',
                'echo "NEXTAUTH_SECRET=17cM2QJHbi9VuO4Vhqt6COMIaqXMV8Z5lU1NCZ325Qg=" >> .env.production',
                'echo "NEXTAUTH_URL=https://main.${AWS_APP_ID}.amplifyapp.com/" >> .env.production',
                `echo "COGNITO_ID=${userPool.userPoolId}" >> .env.production`,
                `echo "COGNITO_CLIENT_ID=${userPoolClient.userPoolClientId}" >> .env.production`
              ]
            }
          },
          artifacts: {
            baseDirectory: '.next',
            files: ['**/*'],
          },
          cache: {
            paths: ['node_modules/**/*'],
          },
        },
    });

    // amplify app from github repository
    const amplifyApp = new amplify.App(this, 'AuthenticationApp', {
      appName: props.appName,
      description: props.appDesc,
      role,
      sourceCodeProvider: new amplify.GitHubSourceCodeProvider({
        owner: props.gitOwner,
        repository: props.gitRepo,
        oauthToken: secret.secretValueFromJson('secret'),
      }),
      autoBranchCreation: {
        autoBuild: true,
        patterns: [props.gitBranch],
      },
      autoBranchDeletion: true,
      buildSpec,
    });

    /**
     * // use this for static apps
     * amplifyApp.addCustomRule(amplify.CustomRule.SINGLE_PAGE_APPLICATION_REDIRECT);
     */

    amplifyApp.addCustomRule({
      source: '/<*>',
      target: '/index.html',
      status: RedirectStatus.NOT_FOUND_REWRITE
    });

    amplifyApp.addEnvironment('COGNITO_ID', userPool.userPoolId)
      .addEnvironment('COGNITO_CLIENT_ID', userPoolClient.userPoolClientId)

    // add main branch
    const main = amplifyApp.addBranch('Main', {
      autoBuild: true,
      branchName: props.gitBranch,
      stage: 'PRODUCTION',
    });

    const domain = amplifyApp.addDomain(props.appName)
    domain.mapRoot(main);
    domain.mapSubDomain(main, 'www'); 

    const setPlatform = new AwsCustomResource(this, 'AmplifySetPlatform', {
      onUpdate: {
        service: 'Amplify',
        action: 'updateApp',
        parameters: {
          appId: amplifyApp.appId,
          platform: 'WEB_COMPUTE'
        },
        physicalResourceId: PhysicalResourceId.of('AmplifyCustomResourceSetPlatform'),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: [amplifyApp.arn] })
    });
    setPlatform.node.addDependency(domain);

    const setFramework = new AwsCustomResource(this, 'AmplifySetFramework', {
      onUpdate: {
        service: 'Amplify',
        action: 'updateBranch',
        parameters: {
          appId: amplifyApp.appId,
          branchName: 'main',
          framework: 'Next.js - SSR'
        },
        physicalResourceId: PhysicalResourceId.of('AmplifyCustomResourceSetFramework'),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: AwsCustomResourcePolicy.ANY_RESOURCE })
    });
    setFramework.node.addDependency(domain);

    NagSuppressions.addStackSuppressions(this, [
      { id: 'AwsSolutions-IAM4', reason: 'Using Amplify AWS Managed Policy.' },
      { id: 'AwsSolutions-IAM5', reason: 'Wildcard in AWS Managed Policy.' },
      { id: 'CdkNagValidationFailure', reason: 'Custom resource uses other node version.' },
      { id: 'AwsSolutions-L1', reason: 'Custom resource uses other node version.' },
    ]);
  }
}
