#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsAmplifyStack } from '../lib/aws-amplify-stack';
import { stackConfig } from './config';

const app = new cdk.App();
new AwsAmplifyStack(app, 'ph-amplify-stack', stackConfig);