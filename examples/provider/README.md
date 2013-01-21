# Introduction

This is the provider app for the Hop.js oauth consumer app. This all will request that the user authenticate with the other application
and then will utilize one of the protected services offered by the other application. 

1. Start the consumer app first 

```shell
(cd ../consumer && node-dev app.js)
``` 

2. Start the provider application 

```shell
(cd ../oauth/ && node-dev app.js)
```

3. Visit consumer app application on port 3010
4. Click 'Perform oauth with provider'
5. Enter the user test / test
6. You will be redirected back to this application
7. Click 'Test to see if oauth is working'
8. If it worked you'll see

```javascript
	{ 
		input:'foo',
		secret:'redkittens'
	}
```
