import * as path from 'path';
import { Duration, RemovalPolicy, Stack, StackProps, aws_lex as lex } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class DemoLexVaCicdStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const lexCodeHook = new lambda.Function(this, 'lexCodeHook', {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset(path.join(__dirname, '../resources/lexBot')),
      handler: 'index.lambda_handler',
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.minutes(1),
    });

    const lexLogGroup = new logs.LogGroup(this, 'lexLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    const lexAudioBucket = new s3.Bucket(this, 'lexAudioBucket', {
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const lexRole = new iam.Role(this, 'lexRole', {
      assumedBy: new iam.ServicePrincipal('lex.amazonaws.com'),
      inlinePolicies: {
        ['lexPolicy']: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ['*'],
              actions: ['polly:SynthesizeSpeech', 'comprehend:DetectSentiment'],
            }),
            new iam.PolicyStatement({
              resources: [lexLogGroup.logGroupArn],
              actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
              ],
            }),
          ],
        }),
      },
    });

    lexAudioBucket.grantReadWrite(lexRole);

    const helloLexBot = new lex.CfnBot(this, 'helloLexBot', {
      dataPrivacy: { ChildDirected: false },
      idleSessionTtlInSeconds: 300,
      name: 'HelloWorldDemo',
      roleArn: lexRole.roleArn,
      autoBuildBotLocales: true,
      botLocales: [
        {
          localeId: 'en_US',
          nluConfidenceThreshold: 0.4,
          voiceSettings: {
            voiceId: 'Joanna',
            engine: 'neural',
          },
          description: 'English_US',
          slotTypes: [
            {
              name: 'accountType',
              description: 'Slot Type description',
              valueSelectionSetting: {
                resolutionStrategy: 'TOP_RESOLUTION',
              },
              slotTypeValues: [
                {
                  sampleValue: {
                    value: 'Checking',
                  },
                },
                {
                  sampleValue: {
                    value: 'Savings',
                  },
                },
                {
                  sampleValue: {
                    value: 'Credit',
                  },
                  synonyms: [
                    {
                      value: 'credit card',
                    },
                    {
                      value: 'visa',
                    },
                    {
                      value: 'mastercard',
                    },
                    {
                      value: 'amex',
                    },
                    {
                      value: 'american express',
                    },
                  ],
                },
              ],
            },
          ],
          intents: [
            {
              name: 'CheckBalance',
              description:
                'Intent to check the balance in the specified account type',
              sampleUtterances: [
                { utterance: 'What’s the balance in my account ?' },
                { utterance: 'Check my account balance' },
                {
                  utterance: 'What’s the balance in my {accountType} account ?',
                },
                { utterance: 'How much do I have in {accountType} ?' },
                { utterance: 'I want to check the balance' },
                { utterance: 'Can you help me with account balance ?' },
                { utterance: 'Balance in {accountType}' },
              ],
              fulfillmentCodeHook: { enabled: true },
              outputContexts: [
                {
                  name: 'contextCheckBalance',
                  timeToLiveInSeconds: 90,
                  turnsToLive: 5,
                },
              ],
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value:
                            'Thanks for checking your balance.  Have a nice day.',
                        },
                      },
                    },
                  ],
                  allowInterrupt: false,
                },
                isActive: true,
              },
              slots: [
                {
                  name: 'accountType',
                  slotTypeName: 'accountType',
                  valueElicitationSetting: {
                    slotConstraint: 'Required',
                    promptSpecification: {
                      maxRetries: 2,
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value:
                                'For which account would you like your balance?',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
                {
                  name: 'dateOfBirth',
                  slotTypeName: 'AMAZON.Date',
                  valueElicitationSetting: {
                    slotConstraint: 'Required',
                    promptSpecification: {
                      maxRetries: 2,
                      messageGroupsList: [
                        {
                          message: {
                            plainTextMessage: {
                              value:
                                'For verification purposes, what is your date of birth?',
                            },
                          },
                        },
                      ],
                    },
                  },
                },
              ],
              slotPriorities: [
                { priority: 1, slotName: 'accountType' },
                { priority: 2, slotName: 'dateOfBirth' },
              ],
            },
            {
              name: 'FallbackIntent',
              parentIntentSignature: 'AMAZON.FallbackIntent',
              intentClosingSetting: {
                closingResponse: {
                  messageGroupsList: [
                    {
                      message: {
                        plainTextMessage: {
                          value:
                            "Sorry I am having trouble understanding. Can you describe what you'd like to do in a few words? I can help you find your account balance, transfer funds and open an account.",
                        },
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    });

    const helloLexBotVersion = new lex.CfnBotVersion(
      this,
      'helloLexBotVersion',
      {
        botId: helloLexBot.ref,
        botVersionLocaleSpecification: [
          {
            botVersionLocaleDetails: {
              sourceBotVersion: 'DRAFT',
            },
            localeId: 'en_US',
          },
        ],
      },
    );

    const helloLexBotAlias = new lex.CfnBotAlias(this, 'helloLexBotAlias', {
      botAliasName: 'HelloBotDemo',
      botId: helloLexBot.ref,
      botAliasLocaleSettings: [
        {
          botAliasLocaleSetting: {
            enabled: true,
            codeHookSpecification: {
              lambdaCodeHook: {
                codeHookInterfaceVersion: '1.0',
                lambdaArn: lexCodeHook.functionArn,
              },
            },
          },
          localeId: 'en_US',
        },
      ],
      conversationLogSettings: {
        audioLogSettings: [
          {
            destination: {
              s3Bucket: {
                logPrefix: 'helloLexBot',
                s3BucketArn: lexAudioBucket.bucketArn,
              },
            },
            enabled: true,
          },
        ],
        textLogSettings: [
          {
            destination: {
              cloudWatch: {
                cloudWatchLogGroupArn: lexLogGroup.logGroupArn.toString(),
                logPrefix: 'helloLexBot',
              },
            },
            enabled: true,
          },
        ],
      },
      botVersion: helloLexBotVersion.getAtt('BotVersion').toString(),
      sentimentAnalysisSettings: { DetectSentiment: true },
    });

    const lexArn = `arn:aws:lex:${Stack.of(this).region}:${
      Stack.of(this).account
    }:bot-alias/${helloLexBot.attrId}/${helloLexBotAlias.attrBotAliasId}`;
    
    lexCodeHook.addPermission('Lex Invocation', {
      principal: new iam.ServicePrincipal('lexv2.amazonaws.com'),
      sourceArn: lexArn,
    });

  }
}
