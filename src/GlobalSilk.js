var nsSilk = require("./nsSilk.js");
var Scope = require("./Scope");
var fStandardLibrary = require("./fStandardLibrary");

var GlobalSilk={};

// --------------------------------------------------------------------
GlobalSilk.scope = new Scope("global");

// --------------------------------------------------------------------
GlobalSilk.fCallbackDigest = function(){console.log("callback")};








// --------------------------------------------------------------------
var cIteration = 0;
var timeoutDraw;
var ffOnDirty = function(fCallback){

	return function(){
		if (!timeoutDraw){
			cIteration ++;
			if (cIteration >= 10){
				return fCallback("TOO MANY ITERATIONS");
			}

			timeoutDraw = setTimeout(function(){
				timeoutDraw = undefined;
				var jq = Silk.scope._._page;
				if (Silk.scope.loVariables.fbIsDirty("_page")){
					return;
				}

				cIteration = 0;
				fCallback(null, jq);
			}, 1);

		}
	};
};

			

// --------------------------------------------------------------------
GlobalSilk.init = function(fCallback){
	var jq=$('body').contents();

	this.scope.defvar('_page',undefined,ffOnDirty(fCallback));
	this.scope.getvar('_page');

	fStandardLibrary(this, this.scope);

	// TODO: we should compile stdlib.silk into a big comment at the end of this
	// file so that we don't have to have an extra network lookup in a real
	// deployemnt
	GlobalSilk.fGet('standardlibrary.silk', function(err,sData){
		nsSilk.compile(GlobalSilk.scope,Silk.parseHTML(sData))();
		GlobalSilk.scope.setvar('_page', nsSilk.compile(GlobalSilk.scope, jq));
		// no need to callback. _page will take care of it.
	});

};

// --------------------------------------------------------------------
GlobalSilk.cleanHTML = function(shtml){
	shtml = shtml.replace(/<defelt/g,"<script type='defelt'");
  shtml = shtml.replace(/<\/defelt>/g,"</script>");
	
	shtml = shtml.replace(/<defun/g,"<script type='defun'");
  shtml = shtml.replace(/<\/defun>/g,"</script>");
	
	shtml = shtml.replace(/<defattr/g,"<script type='defattr'");
  shtml = shtml.replace(/<\/defattr>/g,"</script>");

	return shtml;
},

// --------------------------------------------------------------------
GlobalSilk.fGet = (
	typeof window !== 'undefined' 
		?  function(sUrl, fCallback){
			$.ajax({
				url: sUrl,
				error: function(err){
					fCallback(err);
				},
				success: function(sData, sStatus){
					fCallback(null,sData);
				}
			});
		}
	:  function(sUrl, fCallback){
		var nsFs = require("fs");
		nsFs.readFile(sUrl, function(err,buff){
			if (err){return fCallback(err);}
			fCallback(null, buff.toString());
		});
	}
);


// --------------------------------------------------------------------
GlobalSilk.parseHTML = function(shtml){
	return $($.parseHTML(this.cleanHTML(shtml)));
};

// --------------------------------------------------------------------
GlobalSilk.setContents = nsSilk.fSafeSwapContents;
GlobalSilk.compile = nsSilk.compile;
GlobalSilk.Scope = Scope;


module.exports = GlobalSilk;
