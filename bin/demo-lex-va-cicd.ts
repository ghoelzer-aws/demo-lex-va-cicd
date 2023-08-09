#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DemoLexVaCicdStack } from '../lib/demo-lex-va-cicd-stack-import';

const app = new cdk.App();
new DemoLexVaCicdStack(app, 'DemoLexVaCicdStack');
