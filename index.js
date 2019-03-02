/*
 * Dekoration
 *
 * Copyright (c) 2018 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */
var undef = void 0;
var R = require("rena-js").clone();
var K = require("kalimotxo");
var Koume = require("koume");
R.ignoreDefault(/[ \t\n]+/);

function isArray(obj) {
	return Object.prototype.toString.call(obj) === '[object Array]';
}

function convertSpecialForm(form) {
	var result,
		resultLambda,
		i;
	function convertLet(beginIndex) {
		var letPart = {},
			i;
		for(i = beginIndex + 1; i < form.length; i += 2) {
			letPart[form[i - 1]] = convertSpecialForm(form[i]);
		}
		return {
			"let": {
				"vars": letPart,
				"begin": [convertSpecialForm(form[i - 1])]
			}
		};
	}
	function convertLambda(beginIndex) {
		var args = form.slice(beginIndex, form.length - 1);
		return {
			"function": {
				"args": args,
				"begin": [convertSpecialForm(form[form.length - 1])]
			}
		};
	}
	function convertArray(beginIndex) {
		var result = [],
			i;
		for(i = beginIndex; i < form.length; i++) {
			result.push(convertSpecialForm(form[i]));
		}
		return result;
	}
	function convertIncDec(operator) {
		var result = {};
		result[form[1]] = [operator, form[1], 1];
		return {
			"begin": [
				{
					"set": result
				},
				form[1]
			]
		}
	}
	if(isArray(form)) {
		if(form[0] === "if" || form[0] === "elseif") {
			result = {
				"if": {
					"cond": convertSpecialForm(form[1]),
					"then": convertSpecialForm(form[2])
				}
			};
			if(form[3]) {
				result["if"]["else"] = convertSpecialForm(form[3]);
			}
			return result;
		} else if(form[0] === "else") {
			return {
				"begin": [convertSpecialForm(form[1])]
			}
		} else if(form[0] === "let") {
			return convertLet(1);
		} else if(form[0] === "loop") {
			result = convertLet(2);
			result["name"] = form[1];
			return result;
		} else if(form[0] === "function") {
			resultLambda = convertLambda(2);
			result = {};
			result[form[1]] = resultLambda;
			return {
				"define": result
			};
		} else if(form[0] === "lambda") {
			return convertLambda(1);
		} else if(form[0] === ":") {
			result = {};
			result[form[1]] = convertSpecialForm(form[2]);
			return {
				"define": result
			};
		} else if(form[0] === ":=") {
			result = {};
			result[form[1]] = convertSpecialForm(form[2]);
			return {
				"set": result
			};
		} else if(form[0] === "begin") {
			return {
				"begin": convertArray(1)
			};
		} else if(form[0] === "&&" || form[0] === "and") {
			return {
				"and": convertArray(1)
			};
		} else if(form[0] === "||" || form[0] === "or") {
			return {
				"or": convertArray(1)
			};
		} else if(form[0] === "++") {
			return convertIncDec("+");
		} else if(form[0] === "--") {
			return convertIncDec("-");
		} else {
			return convertArray(0);
		}
	} else {
		return form;
	}
}

var opop = null;
function addOperator(name, command, precedence) {
	function binary(x, y) {
		return [name, x, y];
	}
	function unary(x) {
		return [name, x];
	}
	opop["add" + command](name, precedence, command.startsWith("Infix") ? binary : unary);
}

function initOpop(func) {
	if(!opop) {
		opop = K.Operator({
			id: func,
			actionId: function(x) { return x; },
			follow: /[,;\}\)\.]|=>|$/
		});
		addOperator("++" , "PostfixNonAssoc", 2700);
		addOperator("--" , "PostfixNonAssoc", 2700);
		addOperator("++" , "PrefixNonAssoc" , 2600);
		addOperator("--" , "PrefixNonAssoc" , 2600);
		addOperator("+"  , "Prefix"         , 2600);
		addOperator("-"  , "Prefix"         , 2600);
		addOperator("*"  , "InfixLToR"      , 2400);
		addOperator("/"  , "InfixLToR"      , 2400);
		addOperator("+"  , "InfixLToR"      , 2300);
		addOperator("-"  , "InfixLToR"      , 2300);
		addOperator("<"  , "InfixLToR"      , 2100);
		addOperator(">"  , "InfixLToR"      , 2100);
		addOperator("<=" , "InfixLToR"      , 2100);
		addOperator(">=" , "InfixLToR"      , 2100);
		addOperator("==" , "InfixLToR"      , 2000);
		addOperator("!=" , "InfixLToR"      , 2000);
		addOperator("&&" , "InfixLToR"      , 1600);
		addOperator("||" , "InfixLToR"      , 1500);
		addOperator(":"  , "InfixNonAssoc"  , 1300);
		addOperator(":=" , "InfixNonAssoc"  , 1300);
		addOperator("and", "InfixLToR"      , 600);
		addOperator("or" , "InfixLToR"      , 500);
	}
}

var commas = /[,;]|=>/;
var op = R.Yn(
	function(op, func, dot, element) {
		function parseOp(match, index) {
			return opop.parse(match, index);
		}
		initOpop(func);
		return R.or(
			R.lookahead(/[\+\-\*\/\$\^!#%&@<>:]+\(/).then(func),
			R.then(parseOp).then(R.zeroOrMore(R.then(".").then(element, function(match, syn, inh) {
				return ['.', inh, syn];
			}))).action(function(attr) {
				return convertSpecialForm(attr);
			})
		);
	},
	function(op, func, dot, element) {
		var funcElem = R.then(dot).then(
			R.then("(").then(R.then(op).delimit(commas, function(match, syn, inh) {
				return inh.concat([syn]);
			}, [])).then(")"), function(match, syn, inh) {
				return [inh].concat(syn);
			}
		);
		var funcDo = R.then("{").then(R.then(op).delimit(";", function(match, syn, inh) {
				return inh.concat([syn]);
			}, []), function(match, syn, inh) {
				return inh.concat({
					"begin": convertSpecialForm(syn)
				});
			}
		).then(R.maybe(";")).then("}");
		var postFuncElem = R.then(dot, function(match, syn, inh) {
			return {
				inh: inh,
				syn: [syn]
			};
		}).or(
			R.then(
				R.then("(").then(R.then(op).delimit(commas, function(match, syn, inh) {
					return {
						inh: inh.inh,
						syn: inh.syn.concat([syn])
					};
				})).then(")"), function(match, syn, inh) {
					return inh.inh.concat([syn.syn]);
				}
			),
			R.cond(function() { return true; }).action(function(attr) { return attr.inh.concat([attr.syn]) })
		);
		var postFunc = R.or(
			R.then(postFuncElem).then(funcDo).action(changeAdd),
			R.maybe(postFuncElem)
		);
		function toList(elem) {
			return [elem];
		}
		function changeAdd(anArray) {
			var lastElem = anArray[anArray.length - 1],
				arrayToAdd = anArray[anArray.length - 2];
			return anArray.slice(0, anArray.length - 2).concat([arrayToAdd.concat(lastElem)]);
		}
		return R.or(
			R.then(funcElem).then(funcDo).then(postFunc),
			R.then(funcElem),
			R.then(dot).action(toList).then(funcDo).then(postFunc),
			R.then(dot)
		);
	},
	function(op, func, dot, element) {
		return R.then(element).thenZeroOrMore(R.then(".").then(element, function(match, syn, inh) {
			return ['.', inh, syn];
		}));
	},
	function(op, func, dot, element) {
		return R.or(
			R.then("true", function() { return true; }),
			R.then("false", function() { return false; }),
			R.real(),
			R.then(/[^ \t\n\+\-\*\/\$\^!#%&@<>\.,:;\(\)\{\}\[\]]+/, function(match) {
				return match.replace(/[ \t\n]+$/, "");
			}),
			R.then(/[\+\-\*\/\$\^!#%&@<>:]+/, function(match) { return match; }),
			R.then("(").then(op).then(")")
		);
	}
);

function createEval() {
	var koumeEval = Koume.createEval();
	return function(aString) {
		var parsed = op.parse(aString);
		if(parsed) {
			return koumeEval([parsed.attribute]);
		} else {
			throw new Error("Syntax error");
		}
	}
}

module.exports = createEval();
