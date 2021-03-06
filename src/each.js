// ---------------------------------------------------------------------------
var each = function(x,f){
	if (global.$ && x instanceof $){
		var jq=x;
		var vjq=[];
		for (var n=0,c=jq.get().length; n<c; n++){
			vjq.push(jq.eq(n));
		}
		return each(vjq,f);
	}
	else if (x instanceof Array || x.hasOwnProperty('length')){
		var vx = x;
		for (var n=0,c=vx.length; n<c; n++){
			f(vx[n],n,vx);
		}
	}
	else {
		var ax = x;
		for(var sKey in ax){
			if (ax.hasOwnProperty(sKey)){
				f(ax[sKey],sKey,ax);
			}
		}
	}
};

module.exports = each;
