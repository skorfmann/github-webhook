## API Gateway (HTTP)

- https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop.html

### EventBridge Integration

https://registry.terraform.io/providers/hashicorp/aws/latest/docs/resources/apigatewayv2_integration

- https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-aws-services.html
- https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-aws-services-reference.html#EventBridge-PutEvents
- https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html

## Github Webhook

Secure the Webhook: https://docs.github.com/en/developers/webhooks-and-events/webhooks/securing-your-webhooks

We don't have access to the request body within the custom authorizer Lambda - see here https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-lambda-authorizer.html - So, we can't use Github's request signature to check for the event validity. A potential workaround could be, to put Cloudfront with Lambda@edge in fron of the API Gateway. However, for the sake of simplicity we'll just us a path parameter as a unique token (something like this http://apigwurl.aws.com/hooks/github/${token})


## Usage

- cdktf deploy

get output of API Gateway

build url `https://<api-gateway-url>/<stage>/hooks/github/<token>`

Submit a test event

```
curl -d '{"key1":"value1", "key2":"value2"}' -H "Content-Type: application/json" -X POST -is https://66pw9lps6l.execute-api.eu-central-1.amazonaws.com/production/hooks/github/12345
```

