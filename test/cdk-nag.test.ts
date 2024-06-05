import { App, Aspects, Stack } from "aws-cdk-lib"
import { AwsAmplifyStack } from "../lib/aws-amplify-stack";
import { stackConfig } from "../bin/config";
import { AwsSolutionsChecks } from 'cdk-nag';
import { Annotations, Match } from "aws-cdk-lib/assertions";

describe('Security Check', () => {
    let stack: Stack;
    let app: App;

    beforeAll(() => {
        app = new App();
        stack = new AwsAmplifyStack(app, 'test', stackConfig);
        Aspects.of(stack).add(new AwsSolutionsChecks());
    });

    test('No unsupressed Warnings', () => {
        const warnings = Annotations.fromStack(stack).findWarning('*', Match.stringLikeRegexp('AwsSolutions-.*'));
        expect(warnings).toHaveLength(0);
    });

    test('No unsupressed Errors', () => {
        const errors = Annotations.fromStack(stack).findError('*', Match.stringLikeRegexp('AwsSolutions-.*'));
        expect(errors).toHaveLength(0);
    });
})