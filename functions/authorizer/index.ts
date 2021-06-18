export const handler = async (event: any) => {
  const isAuthorized = event.pathParameters.token === '12345';

  return {
    isAuthorized,
    context: {}
  }
}