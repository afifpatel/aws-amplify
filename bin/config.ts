import { IAWSAmplifyStackProps } from "./types";

export const stackConfig: IAWSAmplifyStackProps = {
    roleName: '',
    roleDesc: 'Role for AWS Amplify',
    secretName: 'AWSAmplify-Secret',
    appName: 'AWSAmplify',
    appDesc: 'App for AWS Amplify',
    gitOwner: 'aws-amplify',
    gitRepo: 'amplify-cli',
    gitBranch: 'master',
};