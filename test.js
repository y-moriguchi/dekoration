/*
 * Dekoration
 *
 * Copyright (c) 2019 Yuichiro MORIGUCHI
 *
 * This software is released under the MIT License.
 * http://opensource.org/licenses/mit-license.php
 */
"use strict";

const black   = "\u001b[30m";
const red     = "\u001b[31m";
const green   = "\u001b[32m";
const yellow  = "\u001b[33m";
const blue    = "\u001b[34m";
const magenta = "\u001b[35m";
const cyan    = "\u001b[36m";
const white   = "\u001b[37m";
const reset   = "\u001b[0m";
const defaultEpsilon = 1e-13;
let passed = 0;
let failed = 0;

function describe(mainTitle, block) {
    const parser = require("./index.js");
    const test = {
        assert: function(title, expect, code) {
            try {
                const actual = parser(code);
                if(actual === expect) {
                    console.log(`  pass: ${title}`);
                    passed++;
                } else {
                    console.log(`  ${red}fail: ${title}: expect ${expect} but actual ${actual}${reset}`);
                    failed++;
                }
            } catch(e) {
                console.log(`  ${red}fail: ${title}: throw exception ${e.message}${reset}`);
                failed++;
            }
        },

        toThrow: function(title, code) {
            try {
                parser(code);
                console.log(`  ${red}fail: ${title}: expect throw exception${reset}`);
                failed++;
            } catch(e) {
                console.log(`  pass: ${title}: ${e.message}`);
                passed++;
            }
        },

        eval: function(code) {
            parser(code);
        }
    };

    console.log(`block: ${mainTitle}`);
    block.call(test);
}

describe("operator", function() {
    this.eval("a:1");
    this.assert("simple operator", 3, "a+2");
    this.assert("operator precedence", 7, "1+2*3");
    this.assert("parenthesis", 9, "(1+2)*3");
    this.toThrow("syntax error", "1+");
});

describe("term", function() {
    this.eval("a:$(1, 2; 3)");
    this.eval("b:$(1, $(2, 4); 3)");
    this.assert("simple", 6, "add(1, 2, 3)");
    this.assert("nested", 6, "add(1, add(2, 3))");
    this.assert("with infix", 6, "add(1, 2+3)");
    this.assert("with infix", 6, "add(1+2, 3)");
    this.assert("dot notation 1", 2, "a.cadr");
    this.assert("dot notation 2", 2, "b.cadr(\"car\")");
    this.assert("dot notation 3", 2, "b.cadr.car");
    this.assert("bracket 1", 2, "[b.cadr](\"car\")");
    this.assert("bracket 2", 2, "[b.cadr].car");
});

describe("if", function() {
    this.assert("if 1", 2, "if(1, 2, 3)");
    this.assert("if 2", 2, "if(1) { 2 } else { 3 }");
    this.assert("if 3", 3, "if(false, 2, 3)");
    this.assert("if 4", 2, "if(1) { 2 }");
    this.assert("if 5", null, "if(false) { 2 }");
    this.assert("ifelse 1", 3, "if(false) { 2 } elseif(2) { 3 } else { 4 }");
    this.assert("ifelse 2", 4, "if(false) { 2 } elseif(false) { 3 } else { 4 }");
    this.assert("ifelse 3", null, "if(false) { 2 } elseif(false) { 3 }");
});

describe("let", function() {
    this.eval("z:961");
    this.assert("let 1", 1, "let(a => 1; a)");
    this.assert("let 2", 3, "let(z => 3; z)");
    this.assert("let 3", 9, "let(9)");
});

describe("loop", function() {
    this.assert("loop 1", 55, "loop(lp; n => 10) { if(n = 1, 1, n + lp(n - 1)) }");
});

describe("letrec", function() {
    this.eval("z:961");
    this.assert("letrec 1", 55, "letrec(lp => lambda(n, m) { if(n = 0, m, lp(n - 1, m + n)) }) { lp(10, 0) }");
    this.assert("letrec 2", 9, "letrec() { 9 }");
    this.assert("letrec 3", 765, "letrec(z => 765) { 765 }");
});

describe("function", function() {
    this.eval("function(lp; n, m) { if(n = 0, m, lp(n - 1, m + n)) }");
    this.eval("function(fn) { 9 }");
    this.assert("function 1", 55, "lp(10, 0)");
    this.assert("function 2", 9, "fn()");
});

describe("lambda", function() {
    this.eval("lp:lambda(n, m) { if(n = 0, m, lp(n - 1, m + n)) }");
    this.eval("fn:lambda() { 9 }");
    this.assert("lambda 1", 55, "lp(10, 0)");
    this.assert("lambda 2", 9, "fn()");
});

describe("functionr", function() {
    this.eval("functionr(fn1; a; rest) { rest(a) }");
    this.eval("functionr(fn2; rest) { rest(0) }");
    this.assert("functionr 1", 765, "fn1(1, 961, 765, 961)");
    this.assert("functionr 2", 765, "fn2(765, 961, 961)");
});

describe("lambdar", function() {
    this.eval("fn1:lambdar(a; rest) { rest(a) }");
    this.eval("fn2:lambdar(rest) { rest(0) }");
    this.assert("lambdar 1", 765, "fn1(1, 961, 765, 961)");
    this.assert("lambdar 2", 765, "fn2(765, 961, 961)");
});

describe(":=", function() {
    this.eval("a:961");
    this.eval("a:=765");
    this.assert(":= 1", 765, "a");
});

describe("begin", function() {
    this.assert("begin 1", 765, "begin(961, 961, 765)");
    this.assert("begin 2", 765, "if(1) { 961; 961; 765 }");
});

describe("q", function() {
    this.assert("q 1", 765, "[q(term(765))](1)");
    this.assert("q 2", "studio765", "q(studio765)");
});

describe("qq", function() {
    this.assert("qq 1", 765, "[qq(term(765))](1)");
    this.assert("qq 2", 1111, "[qq(term(uq(765+346)))](1)");
    this.assert("qq 3", 4, "[qq(term(1, uqs(a(2, 3, 4))))](5)");
});

describe("message", function() {
    this.assert("message 1", 346, "[message(msg1 => 346)]('msg1)");
    this.assert("message 2", 346, "[message(msg1 => 346)].msg1");
    this.assert("message 3", 346, "[message(msg1 => 961; message(msg2 => 346))]('msg2)");
    this.toThrow("message invalid 1", "[message(msg1 => 961)]('invalid)");
});

describe("||, &&", function() {
    this.assert("|| 1", 346, "false || 346");
    this.assert("|| 2", 346, "346 || 961");
    this.assert("|| 3", 346, "`||(false, false, false, 346)");
    this.assert("&& 1", 346, "961 && 346");
    this.assert("&& 2", false, "961 && false");
    this.assert("&& 3", 346, "`&&(961, 961, 961, 346)");
});

describe("delay", function() {
    this.eval("a:0");
    this.eval("d:delay(a)");
    this.eval("a:=765");
    this.assert("delay 1", 765, "force(d)");
    this.eval("a:=961");
    this.assert("delay 2", 765, "force(d)");
});

describe("increment", function() {
    this.eval("a:10");
    this.assert("prefix 1", 11, "++a");
    this.assert("prefix 2", 11, "a");
    this.assert("postfix 1", 11, "a++");
    this.assert("postfix 2", 12, "a");
});

describe("decrement", function() {
    this.eval("a:10");
    this.assert("prefix 1", 9, "--a");
    this.assert("prefix 2", 9, "a");
    this.assert("postfix 1", 9, "a--");
    this.assert("postfix 2", 8, "a");
});

describe("op", function() {
    this.eval("op(2350, yfx, `---)");
    this.eval("function(`---; a, b) { a - b }");
    this.assert("yfx 1", 10, "16---6");
    this.assert("yfx 2", 4, "16---6---6");
    this.assert("yfx 3", 16, "16---(6---6)");
    this.assert("yfx 4", 22, "16-6---6*2");
    this.eval("op(2350, xfy, `--/)");
    this.eval("function(`--/; a, b) { a - b }");
    this.assert("xfy 1", 10, "16--/6");
    this.assert("xfy 2", 16, "16--/6--/6");
    this.assert("xfy 3", 4, "(16--/6)--/6");
    this.assert("xfy 4", 22, "16-6--/6*2");
    this.eval("op(2350, xfx, `--&)");
    this.eval("function(`--&; a, b) { a - b }");
    this.assert("xfx 1", 10, "16--&6");
    this.toThrow("xfx 2", "16--&6--&6");
    this.assert("xfx 3", 4, "(16--&6)--&6");
    this.assert("xfx 4", 22, "16-6--&6*2");
    this.eval("op(2250, yf, `!-)");
    this.eval("function(`!-; a) { -a }");
    this.assert("yf 1", -9, "!-9");
    this.assert("yf 2", 9, "!-!-9");
    this.assert("yf 3", -7, "!-16-9");
    this.eval("op(2250, xf, `!-)");
    this.eval("function(`!-; a) { -a }");
    this.assert("xf 1", -9, "!-9");
    this.toThrow("xf 2", 9, "!-!-9");
    this.assert("xf 3", -7, "!-16-9");
    this.eval("op(2250, fy, `!&)");
    this.eval("function(`!&; a) { -a }");
    this.assert("fy 1", -9, "9!&");
    this.assert("fy 2", 9, "9!&!&");
    this.assert("fy 3", -7, "16-9!&");
    this.eval("op(2250, fx, `!|)");
    this.eval("function(`!|; a) { -a }");
    this.assert("fx 1", -9, "9!|");
    this.toThrow("fx 2", 9, "9!|!|");
    this.assert("fx 3", -7, "16-9!|");
});

describe("while", function() {
    this.eval("i:0");
    this.eval("r:0");
    this.assert("while 1", 10, "while(i <= 10) { r := r + i; i++ }");
    this.assert("while 2", 55, "r");
});

describe("for", function() {
    this.eval("r:0");
    this.assert("for 1", 10, "for(i => 1; i <= 10; i++) { r := r + i; i }");
    this.assert("for 2", 55, "r");
});

describe("defmacro", function() {
    this.eval("defmacro(aif; cond, thenc, elsec) { qq { let(it => uq(cond)) { if(it) { uq(thenc) } else { uq(elsec) } } } }");
    this.assert("defmacro 1", "Yukiho", "aif('Yukiho, it, 961)");
});

describe("defmacror", function() {
    this.eval("defmacror(orz; a; r) { if(r.length > 0) { qq { if(uq(a)) { uq(a) } else { orz(uqs(r)) } } } else { a } }");
    this.assert("defmacror 1", 765, "orz(false, 765, 961)");
    this.assert("defmacror 2", false, "orz(false, false, false)");
    this.assert("defmacror 3", 765, "orz(765)");
});

console.log(`passed: ${passed}, failed: ${failed}`);
