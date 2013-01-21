var express= require('express');
var path = require('path');
var redis = require('redis');

var redisClient = redis.createClient();

var Hop = require("hopjs");
Hop.use(require('../../index'));

var users = {
	1: { username: 'test',password:'test', id:1 },
	2: { username: 'test2', password: 'test2', id:2 },
	3: { username: 'test3', password: 'test3', id:3 }
};

var getUserId=function(user){
	return (user!=null?user.id:null);
}

var loadUserById=function(id){
	return users[id];
}	

var provider = Hop.useOAuth({ 
	crypt_key:"foo",
	sign_key:"bar",
	loginURL: "/login",	
	grantStore: new Hop.RedisGrantStore({ redisClient: redisClient, getUserId: getUserId, loadUserById: loadUserById }),
	accessToken:function(req,token,next){
		req.session.user=loadUserById(token.user_id);
		next();
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

Hop.apiHook("/api/",app);

app.listen(3000);

