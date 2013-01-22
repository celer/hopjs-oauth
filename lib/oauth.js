module.exports=function(Hop){
	var OAuth2Provider = require('oauth2-provider').OAuth2Provider;

	var path = require('path');
	var crypto = require('crypto');

	Hop.RedisClientStore=function(options){
		if(typeof options.redisClient!="object")
			throw new Error("No redisClient function specified");
		this.registerClient=function(client_id,options,onComplete){
			options.redisClient.get("oauth-client-"+client_id,function(err,data){
				if(data){
					return onComplete("A client has already been registered using this client id.");
				}	
				options.redisClient.set("oauth-client-"+client_id,JSON.stringify(options),function(err){
					if(err) return onComplete(err);
					return onComplete(null,options);	
				});
			});
		}
		this.validateClient=function(client_id,client_secret,onComplete){
			options.redisClient.get("oauth-client-"+client_id,function(err,data){
				if(data){	
					data=JSON.parse(data.toString());
					if(client_secret==data.client_secret)
						return onComplete(null,true);
					else return onComplete(null,false);	
				}	else {
					return onComplete(null,false);	
				}
			});
		}
		this.deleteClient=function(client_id,onComplete){
			options.redisClient.del("oauth-client-"+client_id);
		}
		this.registerURL="/oauth/client/register";
		this.manageClients="/oauth/client/manage";
	}

	Hop.RedisGrantStore=function(options){
		if(typeof options.redisClient!="object")
			throw new Error("No redisClient function specified");
		if(typeof options.getUserId!="function")
			throw new Error("No getUserId function specified");
		this.saveGrant=function(req,client_id,code,next){
			//console.log("Save grant",null,client_id,code);
			var key = "oauth_"+client_id.toString()+"_"+code.toString();
			options.redisClient.set(key,options.getUserId(req.session.user));
			next();
		}	
		this.removeGrant=function(user_id,client_id,code){
			//console.log("remove grant",user_id,client_id,code);
			var key = "oauth_"+client_id.toString()+"_"+code.toString();
			options.redisClient.del(key);
		}
		this.lookupGrant=function(client_id,client_secret,code,next){
			//console.log("lookup grant",client_id,client_secret,code);
			var key = "oauth_"+client_id.toString()+"_"+code.toString();
			options.redisClient.get(key,function(err,data){
				if(data!=null){
					var user = JSON.parse(data.toString());
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
			@param {Function} options.clientStore
			@param {Function} options.grantStore
			@param {Function} options.createAccessToken (user_id, client_id, next)
			@param {Function} options.saveAccessToken (user_id, client_id, access_token)
			@param {Function} options.accessToken (req, token, next)
					
	*/
	Hop.useOAuth=function(options){
		if(!options.crypt_key)
			throw new Error("cryptKey must be specified")
		if(!options.sign_key)
			throw new Error("signKey must be specified");
	
		options.authorize_uri = options.authorize_uri||"/oauth/authorize";
		options.access_token_uri = options.access_token_uri || '/oauth/access_token';

		Hop.OAuthAuthorizeURI=options.authorize_uri;
		Hop.OAuthAccessTokenURI=options.access_token_uri;

		Hop._OAuth = { 
			provider: new OAuth2Provider({ crypt_key: options.crypt_key, sign_key: options.sign_key, authorize_uri: options.authorize_uri, access_token_uri:options.access_token_uri}),
			options: options	
		}

		Hop.addBeforeTemplate("Doc",path.join(__dirname,"../static/hopPreDoc.comb"));

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

		return Hop._OAuth.provider;
	}


}
