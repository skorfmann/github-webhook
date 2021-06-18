import { LambdaFunction } from '@cdktf/provider-aws';
import { Resource } from 'cdktf';
import { Construct } from 'constructs';
import { NodejsFunction } from './nodejs-function';
import { Policy } from './policy';
import * as aws from '@cdktf/provider-aws';
import * as iam from 'iam-floyd';

export interface ApiRouteProps {
  readonly api: aws.Apigatewayv2Api;
  readonly route: string;
  readonly authorizer: NodejsFunction;
  readonly integration: aws.Apigatewayv2Integration;
}

export class ApiRoute extends Resource {
  readonly fn: LambdaFunction;

  constructor(scope: Construct, id: string, props: ApiRouteProps) {
    super(scope, id);

    const { authorizer, api, route, integration } = props;

    const role = new aws.IamRole(this, 'role', {
      name: `${id}-role`,
      assumeRolePolicy: Policy.document(new iam.Sts()
        .allow()
        .toAssumeRole()
        .forService('lambda.amazonaws.com')
      )
    })

    this.fn = new aws.LambdaFunction(this, 'fn', {
      functionName: id,
      role: role.arn,
      handler: 'index.handler',
      filename: authorizer.asset.path,
      sourceCodeHash: authorizer.asset.assetHash,
      runtime: 'nodejs14.x'
    })

    new aws.LambdaPermission(this, 'route-authorizer-permission', {
      functionName: this.fn.arn,
      action: "lambda:InvokeFunction",
      principal: "apigateway.amazonaws.com",
      sourceArn: `${api.executionArn}/*/*`
    })

    const auth = new aws.Apigatewayv2Authorizer(this, 'authorizer', {
      name: id,
      apiId: api.id,
      authorizerType: 'REQUEST',
      authorizerPayloadFormatVersion: '2.0',
      authorizerUri: this.fn.invokeArn,
      enableSimpleResponses: true,
      authorizerResultTtlInSeconds: 0
    })

    new aws.Apigatewayv2Route(this, 'route', {
      apiId: api.id,
      routeKey: route,
      authorizationType: 'CUSTOM',
      authorizerId: auth.id,
      target: `integrations/${integration.id}`
    })
  }
}