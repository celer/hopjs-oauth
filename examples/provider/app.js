var express= require('express');
var path = require('path');
var redis = require('redis');

var redisClient = redis.createClient();

var Hop = require("hopjs");
Hop.use(require('../../index'));


/**
	We have a list of hard coded users
*/
var users = {
	1: { username: 'test',password:'test', id:1 },
	2: { username: 'test2', password: 'test2', id:2 },
	3: { username: 'test3', password: 'test3', id:3 }
};

/**
	We need a function to return the id for a given user
*/
var getUserId=function(user){
	return (user!=null?user.id:null);
}


/**
	We need a function to load the user by id
*/	
var loadUserById=function(id,onComplete){
	onComplete(null,users[id]);
}	

/**
	Now we need to setup Hop to use OAuth
*/
var provider = Hop.useOAuth({ 
	crypt_key:"foo",
	sign_key:"bar",
	loginURL: "/login",	
	grantStore: new Hop.RedisGrantStore({ redisClient: redisClient, getUserId: getUserId }),
	accessToken:function(req,token,next){
		console.log("Access token request",token);
		loadUserById(token.user_id,function(err,user){
			if(user){
				req.session.user=user;
				next();
			} else {
				next(new Error("Invalid user"));
			}
		});
	}
});


/*
  This is express boiler plate, see http://expressjs.com/guide.html
*/
var app = express();
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
	/*
		We must add handlers to express to deal with oauth stuff
	*/
	app.use(provider.oauth());
	app.use(provider.login());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.engine("jade",require('jade').__express);

app.get("/",function(req,res){
	if(req.session.user){
		res.send("Authenticated");
	} else {
		res.redirect("/login");
	}
});

app.get("/login",function(req,res){
	if(req.session.user){
		return res.redirect("/");	
	}	else {
		var next_url = req.query.next ? req.query.next:"/";
		res.end('<html><form method="post" action="/login"><input type="hidden" name="next" value="' + next_url + '"><input type="text" placeholder="username" name="username"><input type="password" placeholder="password" name="password"><button type="submit">Login</button></form>');
	}	
});

app.get("/secret",function(req,res){
	if(req.session.user){
		console.log("Session user",req.session.user);
		res.send("OK");
	} else {
		res.send(500,"Permission denied");
	}
});

app.post("/login",function(req,res){
	if(req.body.username){
		for(var i in users){
			var user = users[i];
			if(user.username == req.body.username && user.password==req.body.password){
				req.session.user = user;
				if(req.body.next){
					res.redirect(req.body.next);
				}	else res.redirect("/");
				return;
			}
		}
	}		
	res.redirect("/login");
});

/**
	Now let's define a service we want protected via oauth
*/
ProtectedService={};

ProtectedService.logout=function(input,onComplete,req){
	delete req.session.user;
}

ProtectedService.login=function(input,onComplete,req){
		for(var i in users){
			var user = users[i];
			if(user.username == input.username && user.password==input.password){
				req.session.user = user;
				return onComplete(null,user);
			}
		}
		return onComplete("Permission denied");
}

/*
	We will protected the two services below, if these
	services are called without a user being in the session
	they will reject the call

*/
ProtectedService.doPost=function(input,onComplete){	
	input.secret="redkittens";
	return onComplete(null,input);
}

ProtectedService.doGet=function(input,onComplete){
	input.secret="redkittens";
	return onComplete(null,input);
}

/*
	now lets add a method called 'authed' which 
	will perform our security check
*/
Hop.Method.prototype.authed=function(){
	this.addPreCall(function(req,input,onComplete,next){
		if(!req.session.user){
			return onComplete("Permission denied");
		}	else return next();
	},"first");
	return this;
}

Hop.defineClass("ProtectedService",ProtectedService,function(api){
	api.post("doPost","/protected/post").demand("input").authed();
	api.get("doGet","/protected/post").demand("input").authed();
	api.post("login","/protected/login").demands("username","password");
	api.post("logout","/protected/logout");
});	

Hop.defineTestCase("ProtectedService.doPost",function(test){
	test.do("ProtectedService.doPost").with({input: "foo"}).errorContains("Permission denied");
	test.do("ProtectedService.doGet").with({input: "foo"}).errorContains("Permission denied");
	test.do("ProtectedService.login").with({username: "test",password:"test"}).noError();
	test.do("ProtectedService.doPost").with({input: "foo"}).inputSameAsOutput().outputContains({secret:"redkittens"});
	test.do("ProtectedService.doGet").with({input: "foo"}).inputSameAsOutput().outputContains({secret:"redkittens"});
	test.do("ProtectedService.logout").with({}).noError();
});


Hop.apiHook("/api/",app);

app.listen(3000);

