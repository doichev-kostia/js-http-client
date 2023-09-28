# HTTP client

This is an HTTP client that handles the authentication via access and refresh tokens.
The concept is pretty simple: you have an execution queue that is filled with requests configs and then executed.
The access token expiration is checked before the actual request, so we can refresh it if needed.
When the refresh is needed, the queue is paused until the new access token is retrieved.
After that, the queue is resumed and all the requests are executed with the maintained concurrency.

To "hook up" the response I pass the `resolve` and `reject` callbacks to the request config.

The testing is done with [msw](https://mswjs.io/docs/getting-started/integrate/node) to mock the API and sqlite DB to store the data.

## Requirements

- JWT token should contain `exp` claim
