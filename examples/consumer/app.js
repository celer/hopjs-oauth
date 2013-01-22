
/**
 * Module dependencies.
 */
var passport = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var os = require('os');
var Hop = require('hopjs-remote');

var hostname = os.hostname();
var oauthProvider = 'http://'+hostname+':3000/'


var id=0;
var users = {};

User={};
User.findOrCreate=function(input,onComplete){
	var i = id++;
	input.id=i;
	users[i] =  input;
	return onComplete(null, users[i]);
}	

User.findById=function(id,onComplete){
	onComplete(null,users[id]);
}



passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});


passport.use('provider',new OAuth2Strategy({
	authorizationURL: 'http://'+hostname+':3000/oauth/authorize',
	tokenURL:'http://'+hostname+':3000/oauth/access_token',
	clientID:'hopjs-oauth-client',
	clientSecret: '234234324324',
	callbackURL:'http://'+hostname+':3010/auth/provider/callback'
},function(accessToken,refreshToken,profile,done){
	User.findOrCreate({ accessToken : accessToken, refreshToken: refreshToken, profile: profile },function(err,user){
		done(null,user);
	});
}));




var express = require('express')
  , http = require('http')
  , path = require('path');

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3010);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());	
  app.use(express.cookieParser('your secret here'));
	app.use(express.session());	
	app.use(passport.initialize());
	app.use(passport.session());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req,res){
	res.render("index.jade", { title: "oauth test provider"});
});
app.get('/login',function(req,res){
	res.send('login');
});	
	
app.get("/test",function(req,res){
	if(req.user && req.user.accessToken){
		Hop.remoteAPI(oauthProvider,function(err,api){
			api.setOAuthAccessToken(req.user.accessToken);
			api.ProtectedService.doPost({ input:'foo'},function(err,output){
				if(!err){
					res.send(output);
				} else res.send(500,err);
			});
		});
	} else {
		res.send("Please authenticate with oauth first");
	}
});

app.get('/auth/provider', passport.authenticate('provider'));

app.get('/auth/provider/callback', 
  passport.authenticate('provider', { successRedirect: '/',
                                      failureRedirect: '/login' }));

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
