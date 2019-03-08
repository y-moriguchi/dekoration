/*
 * Dekoration
 *
 * Copyright (c) 2019 Yuichiro MORIGUCHI
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

function convertSpecialForm(form, macroEnv, execEnv) {
    var result,
        resultLambda,
        i;

    function walk(form) {
        return convertSpecialForm(form, macroEnv, execEnv);
    }

    function convertLet(beginIndex, letType) {
        var letPart = {},
            letClause = {},
            result = {},
            i;
        for(i = beginIndex + 1; i < form.length; i += 2) {
            letPart[form[i - 1]] = walk(form[i]);
        }
        letClause = {
            "vars": letPart,
            "begin": [walk(form[i - 1])]
        };
        result[letType] = letClause;
        return result;
    }

    function convertLambda(beginIndex) {
        var args = form.slice(beginIndex, form.length - 1);
        return {
            "function": {
                "args": args,
                "begin": [walk(form[form.length - 1])]
            }
        };
    }

    function convertLambdaRest(beginIndex) {
        var args = form.slice(beginIndex, form.length - 2);
        return {
            "function": {
                "args": args,
                "rest": form[form.length - 2],
                "begin": [walk(form[form.length - 1])]
            }
        };
    }

    function convertArray(beginIndex) {
        var result = [],
            i;
        for(i = beginIndex; i < form.length; i++) {
            result.push(walk(form[i]));
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

    function convertQuasiQuote(quoted) {
        var result,
            i;
        if(isArray(quoted)) {
            if(quoted[0] === "uq") {
                return walk(quoted[1]);
            } else {
                result = ["list"];
                for(i = 0; i < quoted.length; i++) {
                    result.push(convertQuasiQuote(quoted[i]));
                }
                return result;
            }
        } else {
            return { "q": quoted };
        }
    }

    function evaluateMacro(macroDef) {
        var result,
            args = {},
            i;
        function extractMacro(body) {
            var result = [],
                i;
            if(isArray(body)) {
                for(i = 0; i < body.length; i++) {
                    result.push(extractMacro(body[i]));
                }
                return result;
            } else if(args[body] !== undef) {
                return ["q", args[body]];
            } else {
                return body;
            }
        }

        for(i = 0; i < macroDef.args.length; i++) {
            args[macroDef.args[i]] = form[i + 1];
        }
        result = extractMacro(macroDef.body);
            console.log(result);
        return execEnv(walk(result));
    }

    if(isArray(form)) {
        if(form[0] === "if" || form[0] === "elseif") {
            result = {
                "if": {
                    "cond": walk(form[1]),
                    "then": walk(form[2])
                }
            };
            if(form[3]) {
                result["if"]["else"] = walk(form[3]);
            }
            return result;
        } else if(form[0] === "else") {
            return {
                "begin": [walk(form[1])]
            }
        } else if(form[0] === "let") {
            return convertLet(1, "let");
        } else if(form[0] === "loop") {
            result = convertLet(2, "let");
            result["name"] = form[1];
            return result;
        } else if(form[0] === "letrec") {
            return convertLet(1, "letrec");
        } else if(form[0] === "function") {
            resultLambda = convertLambda(2);
            result = {};
            result[form[1]] = resultLambda;
            return {
                "define": result
            };
        } else if(form[0] === "lambda") {
            return convertLambda(1);
        } else if(form[0] === "functionr") {
            resultLambda = convertLambdaRest(2);
            result = {};
            result[form[1]] = resultLambda;
            return {
                "define": result
            };
        } else if(form[0] === "lambdar") {
            return convertLambdaRest(1);
        } else if(form[0] === ":") {
            result = {};
            result[form[1]] = walk(form[2]);
            return {
                "define": result
            };
        } else if(form[0] === ":=") {
            result = {};
            result[form[1]] = walk(form[2]);
            return {
                "set": result
            };
        } else if(form[0] === "do" || form[0] === "begin") {
            return {
                "begin": convertArray(1)
            };
        } else if(form[0] === "q") {
            return {
                "q": form[1]
            };
        } else if(form[0] === "qq") {
            return convertQuasiQuote(form[1]);
        } else if(form[0] === "message") {
            result = {};
            for(i = 2; i < form.length; i += 2) {
                result[form[i - 1]] = walk(form[i]);
            }
            if(form[i - 1]) {
                return {
                    "message": {
                        "extends": walk(form[i - 1]),
                        "messages": result
                    }
                };
            } else {
                return {
                    "message": {
                        "extends": false,
                        "messages": result
                    }
                };
            }
        } else if(form[0] === "&&" || form[0] === "and") {
            return {
                "and": convertArray(1)
            };
        } else if(form[0] === "||" || form[0] === "or") {
            return {
                "or": convertArray(1)
            };
        } else if(form[0] === "delay") {
            return {
                "delay": walk(form[1])
            };
        } else if(form[0] === "++") {
            return convertIncDec("+");
        } else if(form[0] === "--") {
            return convertIncDec("-");
        } else if(form[0] === "op") {
            addOperatorExtern(form[1], form[2], form[3]);
            return true;
        } else if(form[0] === "while") {
            return {
                "while": {
                    "cond": walk(form[1]),
                    "begin": walk(form[2])
                }
            };
        } else if(form[0] === "for") {
            return {
                "for": {
                    "init": form[1],
                    "initValue": walk(form[2]),
                    "cond": walk(form[3]),
                    "step": walk(form[4]),
                    "begin": walk(form[5])
                }
            };
        } else if(form[0] === "defmacro") {
            macroEnv[form[1]] = {
                "args": form.slice(2, form.length - 1),
                "body": form[form.length - 1]
            }
            return false;
        } else if(macroEnv[form[0]]) {
            return walk(evaluateMacro(macroEnv[form[0]]));
        } else {
            return convertArray(0);
        }
    } else {
        return form;
    }
}

var opop = null;
function addOperatorExtern(precedence, operatorType, name) {
    var command = {
        "fx": "PostfixNonAssoc",
        "fy": "Postfix",
        "xf": "PrefixNonAssoc",
        "yf": "Prefix",
        "xfx": "InfixNonAssoc",
        "yfx": "InfixLToR",
        "xfy": "InfixRToL"
    };
    if(!command[operatorType]) {
        throw new Error("invalid operator type");
    }
    addOperator(name, command[operatorType], precedence);
}

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
            follow: /[,;\}\)\]\.]|=>|$/
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
        addOperator("="  , "InfixLToR"      , 2000);
        addOperator("!=" , "InfixLToR"      , 2000);
        addOperator("&&" , "InfixLToR"      , 1600);
        addOperator("||" , "InfixLToR"      , 1500);
        addOperator(":"  , "InfixNonAssoc"  , 1300);
        addOperator(":=" , "InfixNonAssoc"  , 1300);
        addOperator("and", "InfixLToR"      , 600);
        addOperator("or" , "InfixLToR"      , 500);
    }
}

function actionDot(match, inh, syn) {
    return [syn, { q: inh }];
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
            R.then(parseOp).then(R.zeroOrMore(R.then(".").then(element, actionDot))).action(function(attr) {
                return attr;
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
                return inh.concat([["do"].concat(syn)]);
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
        return R.then(element).thenZeroOrMore(R.then(".").then(element, actionDot));
    },

    function(op, func, dot, element) {
        function convertEscape(matched, i) {
            var ch = matched.charAt(i),
                codeString,
                code;
            if(ch === "n") {
                return "\n";
            } else if(ch === "r") {
                return "\r";
            } else if(ch === "b") {
                return "\b";
            } else if(ch === "t") {
                return "\t";
            } else if(ch === "v") {
                return "\v";
            } else if(ch === "f") {
                return "\f";
            } else if(ch === "u") {
                codeString = matched.substring(i + 1, i + 5);
                if(!/^[0-9A-Fa-f]{4,4}$/.test(codeString)) {
                    throw new Error("illegal unicode");
                }
                code = parseInt(codeString, 16);
                return String.fromCharCode(code);
            } else {
                return matched.charAt(i + 1);
            }
        }
        function convertStringLiteral(matched) {
            var i,
                ch,
                result = "";
            for(i = 0; i < matched.length; i++) {
                ch = matched.charAt(i);
                if(ch === "\\") {
                    result += convertEscape(matched, i + 1);
                    i += matched.charAt(i + 1) === "u" ? 5 : 1;
                } else {
                    result += ch;
                }
            }
            return ["q", result];
        }
        return R.or(
            R.then("true", function() { return true; }),
            R.then("false", function() { return false; }),
            R.real(),
            R.then(/\'[^\']+\'/, function(match) {
                return match.substring(1, match.length - 1);
            }),
            R.then(/\"(\\[\s\S]|[^\"])*\"/, function(match) {
                return convertStringLiteral(match.substring(1, match.length - 1));
            }),
            R.then(/[^ \t\n\+\-\*\/\$\^!#%&@<>\.,:;\(\)\{\}\[\]]+/, function(match) {
                return match.replace(/[ \t\n]+$/, "");
            }),
            R.then(/[\+\-\*\/\$\^!#%&@<>:]+/, function(match) { return match; }),
            R.then("[").then(R.then(op).delimit(",", function(match, syn, inh) {
                return inh.concat([syn]);
            }, ["list"])).then("]"),
            R.then("(").then(op).then(")")
        );
    }
);

function initEval(koumeEval) {
    koumeEval([
        {
            defmacro: {
                name: "while",
                patterns: [
                    {
                        pattern: {
                            cond: "cond",
                            begin: "begin"
                        },
                        begin: [
                            {
                                qq: {
                                    "let": {
                                        vars: {
                                            "\x01result": false
                                        },
                                        begin: [
                                            {
                                                "let": {
                                                    name: "\x01loop",
                                                    vars: {},
                                                    begin: [
                                                        {
                                                            "if": {
                                                                "cond": { uq: "cond" },
                                                                "then": {
                                                                    "begin": [
                                                                        {
                                                                            "set": {
                                                                                "\x01result": {
                                                                                    uq: "begin"
                                                                                }
                                                                            }
                                                                        },
                                                                        ["\x01loop"]
                                                                    ]
                                                                },
                                                                "else": "\x01result"
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        true
    ]);

    koumeEval([
        {
            defmacro: {
                name: "for",
                patterns: [
                    {
                        pattern: {
                            init: "init",
                            initValue: "initValue",
                            cond: "cond",
                            step: "step",
                            begin: "begin"
                        },
                        begin: [
                            {
                                qq: {
                                    "let": {
                                        vars: {
                                            uq: ["listToObject", ["list", "init", "initValue", { q: "\x01forResult" }, false]]
                                        },
                                        begin: [
                                            {
                                                "let": {
                                                    name: "\x01forLoop",
                                                    vars: {},
                                                    begin: [
                                                        {
                                                            "if": {
                                                                "cond": { uq: "cond" },
                                                                "then": {
                                                                    begin: [
                                                                        {
                                                                            "set": {
                                                                                "\x01forResult": {
                                                                                    uq: "begin"
                                                                                }
                                                                            }
                                                                        },
                                                                        { uq: "step" },
                                                                        ["\x01forLoop"]
                                                                    ]
                                                                },
                                                                "else": "\x01forResult"
                                                            }
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        ]
                    }
                ]
            }
        },
        false
    ]);
}

function createEval() {
    var koumeEval = Koume.createEval(),
        macroEnv = {};
    initEval(koumeEval);
    return function(aString) {
        var parsed = op.parse(aString);
        if(parsed) {
            return koumeEval([convertSpecialForm(parsed.attribute, macroEnv, koumeEval)]);
        } else {
            throw new Error("Syntax error");
        }
    }
}

module.exports = createEval();
