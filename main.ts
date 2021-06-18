import { Construct } from 'constructs';
import { App, TerraformStack, RemoteBackend, TerraformOutput } from 'cdktf';
import * as aws from '@cdktf/provider-aws';
import { NodejsFunction, ApiRoute, Policy } from './lib'
import * as path from 'path';
import * as iam from 'iam-floyd';

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new aws.AwsProvider(this, 'default', {
      region: 'eu-central-1'
    })

    const api = new aws.Apigatewayv2Api(this, 'api', {
      name: 'supportmeister',
      protocolType: 'HTTP'
    })

    const eventBridge = new aws.CloudwatchEventBus(this, 'eventbridge', {
      name: 'supportmeister'
    })

    const integrationRole = new aws.IamRole(this, 'integration-role', {
      name: `integration-role`,
      assumeRolePolicy: Policy.document(new iam.Sts()
        .allow()
        .toAssumeRole()
        .forService('apigateway.amazonaws.com')
      ),
      inlinePolicy: [
        {
          name: 'allow-eventbridge',
          policy: Policy.document(new iam.Events().allow().toPutEvents().on(eventBridge.arn))
        }
      ]
    })

    const eventBridgeIntegration = new aws.Apigatewayv2Integration(this, 'eventbridge-integration', {
      apiId: api.id,
      integrationType: 'AWS_PROXY',
      integrationSubtype: 'EventBridge-PutEvents',
      credentialsArn: integrationRole.arn,
      requestParameters: {
        Detail: '$request.body',
        DetailType: 'IncomingGithubWebhook',
        Source: 'com.cdktf.supportmeister',
        EventBusName: eventBridge.name
      }
    })

    new ApiRoute(this, 'github-hook', {
      api,
      route: 'POST /hooks/github/{token}',
      authorizer: new NodejsFunction(this, 'authorizer', {
        path: path.join(__dirname, 'functions', 'authorizer', 'index.ts')
      }),
      integration: eventBridgeIntegration
    })

    new aws.Apigatewayv2Stage(this, 'production', {
      apiId: api.id,
      name: 'production',
      autoDeploy: true
    })

    new TerraformOutput(this, 'url', {
      value: api.apiEndpoint
    })

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: 'cdktf',
      workspaces: {
        name: 'clerk'
      }
    });
  }
}

const app = new App();
new MyStack(app, 'stream');

app.synth();
