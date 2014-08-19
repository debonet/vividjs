"use strict";

var each = require("./each");
var Scope = require("./LiveObject");
var LiveValue = require("./LiveValue");
var ffBind = require("./ffBind");

// ---------------------------------------------------------------------------
var D = function(){
  Function.apply.call(console.log, console, arguments);
};


// ---------------------------------------------------------------------------
var fCopyAttributes = function(jqTo, jqFrom){
	// copy attributes
	each(jqFrom.prop("attributes"), function(aAttr){
		var sAttr = aAttr["name"];
		var sVal = aAttr["value"];
		jqTo.attr(sVar, sVal);
	});
};

// ---------------------------------------------------------------------------
var faAttributes = function(jq){
	var a = {};
	if (!jq.length){
		return a;
	}

	each(jq[0].attributes, function(aAttr){
		var sAttr = aAttr["name"];
		var sVal = aAttr["value"];
		if (sAttr && typeof(sAttr) === "string" && sVal){
			a[sAttr] = sVal;
		}
	});
	return a;
};

// ---------------------------------------------------------------------------
var ffjqPassthrough = function(scope){
	return function(){
		var _ = scope._;
		var jq = $("<" + _._element + ">");
		each(scope._attributes, function(sVal, sVar){
			jq.attr(sVar,_[sVar]);
		});
		jq.append(_._inner.clone());

		return jq;
	}
};


// ---------------------------------------------------------------------------
var fsUnescape = function(s){
	// NOTE: this may not be efficient. compare to replace(re,f) style
	return s
		.replace(/&amp;/gim,"&")
		.replace(/&lt;/gim,"<")
		.replace(/&gt;/gim,">")
		.replace(/&quot/gim,"\"")
		.replace(/&#x27;/gim,"'");
};


// ---------------------------------------------------------------------------
var fDefElement = function(scope,jq){
	var sBody = jq.html();

	var aAttr = faAttributes(jq);
	var sName = aAttr["name"];
	var sScope = "scope";
	var sQuery = "jq";
	delete aAttr["name"];
	delete aAttr["scope"];
	delete aAttr["query"];

	
	var afClosure = {};
	each(aAttr, function(sVal, sVar){
		// we allow the argument to be an expression
		afClosure[sVar]=scope.expr(sVal);
	});


	sBody = fsUnescape(sBody);

	// using this eval trick gives us a closure over $ 
	var f=eval(
		"(function(" + sScope + "," + sQuery + "){\n"
			+ "var defvar     = ffBind(" + sScope + ", 'defvar');\n"
			+ "var defmutable = ffBind(" + sScope + ", 'defmutable');\n"
			+ "var delvar     = ffBind(" + sScope + ", 'delvar');\n"
			+ "var checkvar   = ffBind(" + sScope + ", 'checkvar');\n"
			+ "var _          = " + sScope + "._;\n"
			+ sBody 
			+"\n})"
	);


	scope.defvar(
		sName,
		function(){
			return function(scopeIn,jqIn){
				// arguments
				each(afClosure, function(fClosure, sVar){
					scopeIn.defvar(sVar, fClosure);
				});
				return f(scopeIn,jqIn);
			}
		}
	);
};


// ---------------------------------------------------------------------------
var fDefMacro = function(scope, jq){
	var aAttr = faAttributes(jq);
	var sName = aAttr["name"];
	var sScope = "scope";
	var sQuery = "jq";
	delete aAttr["name"];
	delete aAttr["scope"];
	delete aAttr["query"];

	D("DEFINING MACRO " + sName + " IN SCOPE " + scope.sName);
	scope.defvar(sName, function(){
		return function(scopeIn, jqIn){
			return function(){
				each(aAttr, function(sVal, sVar){
					scopeIn.defvar(sVar, scopeIn.expr(sVal));
				});
				each(faAttributes(jqIn), function(sVal, sVar){
					scopeIn.defvar(sVar, scopeIn.expr(sVal));
				});
				return compile(scopeIn, jq.contents())();
			};
		};
	});

};

// ---------------------------------------------------------------------------
var reExpr = /\{\{(.*?)\}\}/g;
var ffjqEvalText = function(scope,jqScript){
	var s=jqScript.text();
	var re=reExpr;

	var aMatch;
	var vx=[];
	var n = 0;


	while(aMatch = re.exec(s)){
		var c = aMatch[0].length;
		vx.push(s.slice(n,aMatch["index"]));
		n=aMatch["index"] + c;
		vx.push(scope.expr(aMatch[1]));
	};
	vx.push(s.slice(n));

	return function(){
		var vs=[];

		each(vx,function(x){
			if (typeof(x) === "function"){
				x=x(scope);
			}
			vs.push(x);
		});

		var s=vs.join('');
		s=s.replace(/\\\n/g,"");
		return $("<div>").text(s).contents();
	}
};

// ---------------------------------------------------------------------------
var ffjqEvalElements = function(scope, jq){
	var vf = [];
	each(jq.get(),function(e){
		vf.push(ffjqEvalElement(scope, $(e)));
	});

	return function(){
		var jqInner=$();
		each(vf, function(f,n){
			jqInner = jqInner.add(f(scope));
		});
		return jqInner;
	};
};

var compile = ffjqEvalElements;


// ---------------------------------------------------------------------------
var ffjqEvalElement = function(scopeIn,jqScript){
	var nNodeType = jqScript.get()[0].nodeType;
	var sElement  = (jqScript.prop('tagName')+"").toLowerCase();

	if (nNodeType === 8 
			|| jqScript.length === 0 
			|| sElement === "script" 
			|| sElement ==="defmacro"
		 ){
		return function(){return $();};
	}

	if (nNodeType === 3){
		return  ffjqEvalText(scopeIn, jqScript);
	}

	var scope = scopeIn.fscopeClone(scopeIn.sName + "." + sElement);

	// find defelt
	jqScript.find("script[type=defelt]").each(function(n,e){
		fDefElement(scope,$(e) );
	});

	// find defmacros
	jqScript.children("defmacro").each(function(n,e){
		fDefMacro(scope,$(e));
	});

	// predeclare the _inner so that the element is bound
	// to the _inner of its own scope
	scope.defvar("_inner");
	scope.defvar("_createInner");

	var ffjq = (
		scopeIn.checkvar(sElement)
			? scopeIn.get(sElement)
			: ffjqPassthrough
	);

	var fjq = ffjq(scope,jqScript);

	var aAttr = faAttributes(jqScript);
	scope.defvar("_element",sElement);
	scope.defvar("_attributes",aAttr);
	each(aAttr, function(sVal, sVar){
		scope.defvar(sVar, scopeIn.expr(sVal));
	});

	scope._._createInner = function(){
		return function(scope){
			return ffjqEvalElements(scope,jqScript.contents());
		}
	};


	// quick alias for _._createInner(_);
	scope._._inner = ffjqEvalElements(scope, jqScript.contents());

	return fjq;
};




var nsSilk = {};

// ---------------------------------------------------------------------------
nsSilk.digest = function(scope, sVar, cIterations){
	cIterations = cIterations || 10;

	var x;
	for (var n=0; n<cIterations; n++){
		x = scope.get(sVar);
		if (!scope.fbIsDirty(sVar)){
			break;
		}
		D("iterating..." + n + "/" + cIterations);
	}	
	if (scope.fbIsDirty(sVar)){
		console.warn("Reached " + cIterations + " giving up...");
	}

	return x;
};

// ---------------------------------------------------------------------------
nsSilk.compile = ffjqEvalElements;

// ---------------------------------------------------------------------------
nsSilk.fjqSilkify = function(jqIn, scope, cIterations){
	scope = scope || new Scope("global");
	cIterations = cIterations || 10;

	scope.defvar("_page", ffjqEvalElements(scope, jqIn));

	return nsSilk.fjqRefresh(scope, cIterations);
};


module.exports = nsSilk;
