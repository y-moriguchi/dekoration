# Dekoration

Dekoration is a programming language.  
Dekoration has features shown as follows.

* First class functions and closures
* Infix operators which can be defined by users
* Tail recursion optimization
* First class continuation
* LISP like macros

## Example

This is an example of Dekoration code.
```
function(fac; n; if(n <= 1, 1, n * fac(n - 1)))
```

This code is equivalent to above code.
```
function(fac; n) {
    if(n <= 1) {
        1
    } else {
        n * fac(n - 1)
    }
}
```

