module.exports=function(Hop){
	var OAuth2Provider = require('oauth2-provider').OAuth2Provider;


	Hop.RedisGrantStore=function(options){
		if(typeof options.redisClient!="object")
			throw new Error("No redisClient function specified");
		if(typeof options.getUserId!="function")
			throw new Error("No getUserId function specified");
		if(typeof options.loadUserById!="function"){
			throw new Error("No loadUserByID function specified");
		}
		this.saveGrant=function(req,client_id,code,next){
			var key = "oauth_"+client_id.toString()+"_"+code.toString();
			options.redisClient.set(key,options.getUserId(req.session.user));
			next();
		}	
		this.removeGrant=function(user_id,client_id,code){
			var key = "oauth_"+client_id.toString()+"_"+code.toString();
			options.redisClient.del(key);
		}
		this.lookupGrant=function(client_id,client_secret,code,next){
			var key = "oauth_"+client_id.toString()+"_"+code.toString();
			options.redisClient.get(key,function(err,data){
				if(data!=null){
					var data = JSON.parse(data.toString());
					var user = options.loadUserByID(data);
					next(null,user);
				} else {
					next(new Error("Invalid grant"));
				}
			});
		}
	}


	/**
		Tell Hop to allow use of oAuth

		@param {Object} options
			@param {String} options.crypt_key 
			@param {String} options.sign_key
			@param {String} options.loginURL
			@param {String} options.loginTemplate
			@param {Function} options.grantStore
			@param {Function} options.createAccessToken (user_id, client_id, next)
			@param {Function} options.saveAccessToken (user_id, client_id, access_token)
			@param {Function} options.accessToken (req, token, next)
					
	*/
	Hop.useOAuth=function(options){
		Hop._OAuth = { 
			provider: new OAuth2Provider({ crypt_key: options.crypt_key, sign_key: options.sign_key }),
			options: options	
		}
		if(options.grantStore){
			if(typeof options.grantStore.saveGrant=="function"){
				Hop._OAuth.provider.on("save_grant",options.grantStore.saveGrant);
			}
			if(typeof options.grantStore.saveGrant=="function"){
				Hop._OAuth.provider.on("remove_grant",options.grantStore.removeGrant);
			}
			if(typeof options.grantStore.lookupGrant=="function"){
				Hop._OAuth.provider.on("lookup_grant",options.grantStore.lookupGrant);
			}
		} else {
			throw new Error("Error missing grant store");
		}
		if(typeof options.createAccessToken=="function"){
			Hop._OAuth.provider.on("create_access_token",options.createAccessToken);
		} else {
			Hop._OAuth.provider.on("create_access_token",function(user_id,client_id,next){ return next(null); });
		}
		if(typeof options.saveAccessToken=="function"){
			Hop._OAuth.provider.on("save_access_token",options.saveAccessToken);
		} 
		if(typeof options.accessToken=="function"){
			Hop._OAuth.provider.on("access_token",options.accessToken);
		} else {
			throw "Missing required function 'accessToken(req,token,next)'";
		}

		Hop._OAuth.provider.on('enforce_login',function(req,res,authorize_url,next){
			if(req.session.user){
				next(req.session.user);
			} else {
				res.writeHead(303,{ Location: Hop._OAuth.options.loginURL+"?next="+encodeURIComponent(authorize_url)});
				res.end();
			}
		});

		Hop._OAuth.provider.on("authorize_form",function(req,res,client_id,authorize_url){
			if(options.loginTemplate){
				res.render(Hop._OAuth.options.loginTemplate,{ client_id: client_id, authorize_url:authorize_url});
			} else {
				res.end('<html>this app wants to access your account... <form method="post" action="' + authorize_url + '"><button name="allow">Allow</button><button name="deny">Deny</button></form>');
			}
		});

		console.log(Hop._OAuth);
		return Hop._OAuth.provider;
	}


}
