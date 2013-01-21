# Introduction

This is the oauth plugin for Hop.js (http://github.com/celer/hopjs)

To use this plugin simply use it like so

```javascript

var Hop = require('hopjs');

Hop.use(require('hopjs-oauth'));

//This function when provided with a user object will return the id of the user
var getUserId=function(){ ...}

var provider = Hop.useOAuth({ 
	crypt_key:"foo",
	sign_key:"bar",
	loginURL: "/login",	
	grantStore: new Hop.RedisGrantStore({ redisClient: redisClient, getUserId: getUserId }),
	accessToken:function(req,token,next){
		console.log("Access token request",token);
		
		loadUserById(token.user_id, function(err,user){
			if(user){
				req.session.user=user;
				next();
			} else {
				next(new Error("Unable to load user"));
			}
		});
	}
});


var app = express();
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
	app.use(provider.oauth());
	app.use(provider.login());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

```

See http://github.com/celer/hopjs-oauth/examples/provider and http://github.com/celer/hopjs-oauth/examples/consumer for working examples
