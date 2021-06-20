import { Construct } from 'constructs';
import { App, TerraformStack, TerraformOutput } from 'cdktf';
import * as aws from '@cdktf/provider-aws';
import { Dispatcher } from '../index';

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new aws.AwsProvider(this, 'default', {
      region: 'eu-central-1'
    })

    const eventBridge = new aws.CloudwatchEventBus(this, 'eventbridge', {
      name: 'supportmeister-test'
    })

    const dispatcher = new Dispatcher(this, 'dispatcher-test', {
      eventBridge,
      eventPattern: {
        source: [
          { 'prefix': 'com.supportmeister.hooks' }
        ]
      }
    })

    new TerraformOutput(this, 'table', {
      value: dispatcher.table.arn
    }).overrideLogicalId('table')

    new TerraformOutput(this, 'workflow', {
      value: dispatcher.workflow.arn
    }).overrideLogicalId('workflow')
  }
}

const app = new App();
new MyStack(app, 'stream');
app.synth();
