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

    function convertPreIncDec(operator) {
        var result = {};
        result[form[1]] = [operator, form[1], 1];
        return {
            "begin": [
                {
                    "set": result
                },
                form[1]
            ]
        };
    }

    function convertPostIncDec(operator) {
        var result = {},
            resultLet = {},
            gsym = gsymFunction();
        result[form[1]] = [operator, form[1], 1];
        resultLet = {
            "let": {
                "vars": {},
                "begin": [
                    {
                        "set": result
                    },
                    gsym
                ]
            }
        };
        resultLet["let"].vars[gsym] = form[1];
        return resultLet;
    }

    function convertQuasiQuote(quoted) {
        var result,
            walked,
            i,
            j;
        if(isArray(quoted)) {
            if(quoted[0] === "uq") {
                return walk(quoted[1]);
            } else {
                result = ["list"];
                for(i = 0; i < quoted.length; i++) {
                    if(isArray(quoted[i]) && quoted[i][0] === "uqs" && isArray(quoted[i][1])) {
                        walked = quoted[i][1];
                        if(walked[0] === "\x01q") {
                            walked = walked[1];
                        }
                        for(j = 0; j < walked.length; j++) {
                            result.push(convertQuasiQuote(walked[j]));
                        }
                    } else {
                        result.push(convertQuasiQuote(quoted[i]));
                    }
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
                return ["\x01q", args[body]];
            } else {
                return body;
            }
        }

        for(i = 0; i < macroDef.args.length; i++) {
            args[macroDef.args[i]] = form[i + 1];
        }
        if(macroDef.rest) {
            args[macroDef.rest] = form.slice(i + 1, form.length);
        }
        result = extractMacro(macroDef.body);
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
            result["let"]["name"] = form[1];
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
        } else if(form[0] === "begin") {
            return {
                "begin": convertArray(1)
            };
        } else if(form[0] === "q" || form[0] === "\x01q") {
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
        } else if(form[0] === "&&") {
            return {
                "and": convertArray(1)
            };
        } else if(form[0] === "||") {
            return {
                "or": convertArray(1)
            };
        } else if(form[0] === "delay") {
            return {
                "delay": walk(form[1])
            };
        } else if(form[0] === "prefixInc") {
            return convertPreIncDec("+");
        } else if(form[0] === "prefixDec") {
            return convertPreIncDec("-");
        } else if(form[0] === "postfixInc") {
            return convertPostIncDec("+");
        } else if(form[0] === "postfixDec") {
            return convertPostIncDec("-");
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
        } else if(form[0] === "defmacror") {
            macroEnv[form[1]] = {
                "args": form.slice(2, form.length - 2),
                "rest": form[form.length - 2],
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

function addOperator(name, command, precedence, formName) {
    function binary(x, y) {
        return [formName, x, y];
    }
    function unary(x) {
        return [formName, x];
    }
    if(!formName) {
        formName = name;
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
        addOperator("++" , "PostfixNonAssoc", 2700, "postfixInc");
        addOperator("--" , "PostfixNonAssoc", 2700, "postfixDec");
        addOperator("++" , "PrefixNonAssoc" , 2600, "prefixInc");
        addOperator("--" , "PrefixNonAssoc" , 2600, "prefixDec");
        addOperator("+"  , "Prefix"         , 2600);
        addOperator("-"  , "Prefix"         , 2600);
        addOperator("!"  , "Prefix"         , 2600);
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
        addOperator("===", "InfixLToR"      , 2000);
        addOperator("!==", "InfixLToR"      , 2000);
        addOperator("&&" , "InfixLToR"      , 1600);
        addOperator("||" , "InfixLToR"      , 1500);
        addOperator(":"  , "InfixNonAssoc"  , 1300);
        addOperator(":=" , "InfixNonAssoc"  , 1300);
    }
}

function actionDot(match, inh, syn) {
    return [syn, { q: inh }];
}

var commas = /[,;]|=>/;
var op = R.Yn(
    function(op, func, dot, element) {
        var dotElement = R.then(element, actionDot),
            dotCall,
            dotCall0;
        function parseOp(match, index) {
            return opop.parse(match, index);
        }
        dotCall = R.then("(").action(function(attr) { return [attr]; }).then(R.delimit(op, commas, function(match, syn, inh) {
            return inh.concat([syn]);
        })).then(")");
        dotCall0 = R.then("(").then(")").action(function(attr) { return [attr]; });
        initOpop(func);
        return R.or(
            R.lookahead(/[\+\-\*\/\$\^!#%&@<>:]+\(/).then(func),
            R.lookahead(R.then(dot).then("(").then(")")).then(func),
            R.lookahead(R.then("(").then(func).then(")").then("(")).then(func),
            R.then(parseOp).then(R.zeroOrMore(R.then(".").then(R.or(dotCall0, dotCall, dotElement)))).action(function(attr) {
                return attr;
            })
        );
    },

    function(op, func, dot, element) {
        var funcElem = R.then(dot).then(
            R.or(
                R.then("(").then(")").action(function(attr) { return []; }),
                R.then("(").then(R.then(op).delimit(commas, function(match, syn, inh) {
                    return inh.concat([syn]);
                }, [])).then(")")
            ), function(match, syn, inh) {
                return [inh].concat(syn);
            }
        );
        var funcDo = R.then("{").then(R.then(op).delimit(";", function(match, syn, inh) {
                return inh.concat([syn]);
            }, []), function(match, syn, inh) {
                return inh.concat([["begin"].concat(syn)]);
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
            R.then("(").then(")").action(function(attr) { return [attr] }),
            R.cond(function() { return true; }).action(function(attr) { return attr.inh.concat([attr.syn]) })
        );
        var postFunc = R.or(
            R.then(func, function(match, syn, inh) {
                return inh.concat([syn]);
            }),
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
            R.then(/`.+?(?=[\s\(\)\[\]\{\},;]|=>)/, function(match) {
                return match.substring(1, match.length);
            }),
            R.then(/\'.+?(?=[\s\(\)\[\]\{\},;]|=>)/, function(match) {
                return convertStringLiteral(match.substring(1, match.length));
            }),
            R.then(/\"(\\[\s\S]|[^\"])*\"/, function(match) {
                return convertStringLiteral(match.substring(1, match.length - 1));
            }),
            R.then(/[^ \t\n\+\-\*\/\$\^!#%&@<>\.,:;\(\)\{\}\[\]]+/, function(match) {
                return match.replace(/[ \t\n]+$/, "");
            }),
            R.then("#[").then(R.or(
                R.then("]").action(function() { return [] }),
                R.then(R.then(op).delimit(",", function(match, syn, inh) {
                    return inh.concat([syn]);
                }, [])).then("]")
            )).action(function(attr) { return ["q", attr]; }),
            R.then(/[\+\-\*\/\$\^!#%&@<>:]+/, function(match) { return match; }),
            R.then("[").then(op).then("]")
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

function initCodeEval(evalCode) {
    evalCode(
        "function(createList; base) {" +
        "  lambda(msg) {" +
        "    result:base;" +
        "    if(eqv(msg(0), \"c\") || eqv(msg(msg.length - 1), \"r\")) {" +
        "      for(i => length(msg) - 2; i >= 1; i--) {" +
        "        if(eqv(substring(msg, i, i + 1), \"a\")) {" +
        "          result := result.car" +
        "        } elseif(eqv(substring(msg, i, i + 1), \"d\")) {" +
        "          result := result.cdr" +
        "        } else {" +
        "          error(\"Error: invalid message\")" +
        "        }" +
        "      };" +
        "      result" +
        "    } elseif(msg === \"nullp\") {" +
        "      base(\"nullp\")" +
        "    }" +
        "  }" +
        "}");

    evalCode(
        "function(conspair; car, cdr) {" +
        "  createList(" +
        "    message(" +
        "      car => car," +
        "      cdr => cdr," +
        "      nullp => false" +
        "    )" +
        "  )" +
        "}");

    evalCode(
        "functionr(consseq; seq; rest) {" +
        "  index:if(rest.length < 1, 0, rest(0));" +
        "  createList(" +
        "    message(" +
        "      car => seq(index)," +
        "      cdr => if(index < seq.length - 1, consseq(seq, index + 1), nil)," +
        "      nullp => false" +
        "    )" +
        "  )" +
        "}");

    evalCode(
        "functionr(consrange; start; rest) {" +
        "  end:if(rest.length < 1, false, rest(0));" +
        "  step:if(rest.length < 2, 1, rest(1));" +
        "  createList(" +
        "    message(" +
        "      car => start," +
        "      cdr => if(!end || start + step <= end, consrange(start + step, end, step), nil)," +
        "      nullp => false" +
        "    )" +
        "  )" +
        "}");

    evalCode(
        "nil:message(" +
        "  car => error(\"Error: nil\")," +
        "  cdr => error(\"Error: nil\")," +
        "  nullp => true" +
        ")");

    evalCode(
        "functionr(`$; rest) {" +
        "  result:rest(rest.length - 1);" +
        "  for(i => rest.length - 2; i >= 0; i--) {" +
        "    result := conspair(rest(i), result)" +
        "  };" +
        "  result" +
        "}");

    evalCode(
        "functionr(`#; rest) {" +
        "  result:nil;" +
        "  for(i => rest.length - 1; i >= 0; i--) {" +
        "    result := conspair(rest(i), result)" +
        "  };" +
        "  result" +
        "}");

    evalCode(
        "function(consToArray; seq) {" +
        "  result:#[];" +
        "  loop(main; i => 0, seq => seq) {" +
        "    if(seq.nullp) {" +
        "      result" +
        "    } else {" +
        "      setprop(numberToString(i), result, seq.car);" +
        "      main(i + 1, seq.cdr)" +
        "    }" +
        "  }" +
        "}");

    evalCode(
        "defmacro(do; body, cond) {" +
        "  if(cond(0) === \"while\") {" +
        "    let(lp => gsym(), result => gsym()) {" +
        "      qq(" +
        "        let(uq(result) => false) {" +
        "          loop(uq(lp)) {" +
        "            uq(result) := uq(body);" +
        "            if(uq(cond(1)), uq(lp)(), uq(result))" +
        "          }" +
        "        }" +
        "      )" +
        "    }" +
        "  } else {" +
        "    error(\"Invalid do\")" +
        "  }" +
        "}");
}

function createGsymFunction() {
    var count = 1;
    return function() {
        return "\x01\x01\x01" + (count++);
    };
}
var gsymFunction = createGsymFunction();

function createCreateBuiltIn(option) {
    var opt = option || {},
        loadFunc;
    function defaultLoad() {
        throw new Error("Cannot load in this environment");
    }
    function createBuiltIn(bindBuiltIn) {
        bindBuiltIn("!", function(arg) {
            return arg === false ? true : false;
        });

        bindBuiltIn("===", function(arg1, arg2) {
            return arg1 === arg2;
        });

        bindBuiltIn("!==", function(arg1, arg2) {
            return arg1 !== arg2;
        });

        bindBuiltIn("gsym", gsymFunction);
        bindBuiltIn("load", loadFunc);
    }
    loadFunc = opt.load || defaultLoad;
    return createBuiltIn;
}

function insertCallDot(aProgram) {
    return aProgram.replace(/("(?:\\[\s\S]|[^"\\])*")|\)\(/g, function(match, dq, paren) {
        if(dq) {
            return dq;
        } else {
            return ").("
        }
    });
}

function createEval(option) {
    var koumeEval = Koume.createEval(createCreateBuiltIn(option)),
        macroEnv = {},
        me;
    function evalCode(aString) {
        var aPreprocessed = insertCallDot(aString),
            parsed = op.parse(aPreprocessed);
        if(parsed) {
            return koumeEval([convertSpecialForm(parsed.attribute, macroEnv, koumeEval)]);
        } else {
            throw new Error("Syntax error");
        }
    }

    initEval(koumeEval);
    initCodeEval(evalCode);
    return evalCode;
}

module.exports = createEval;
