# Rust-IDE
#### Brackets extension Rust-IDE
----

Install racer so you can do autocomplete in Brackets when coding Rust, then open the Rust-IDE Settings dialog from File Menu, set the correct racer path.

Get ``racer`` here: 
https://github.com/phildawes/racer

#### Screenshot
![Rust-IDE](https://raw.githubusercontent.com/rrandom/Brackets-Rust-IDE/master/images/screenshot.png)



#### To-Do
1. Do not call racer when cursor inside string("").
    ;; search for codemirror might be helpful, because codemirror could highlight string.
    
2. Call racer once a word, not once a character.
    ;; maybe need a variable to track current word

3. Add syntax words hint like ``fn, use, match``.

4. Add common macros hint like ``println!``.

5. Add highlight for toml.(both *.toml and *.lock)
    ;; http://codemirror.net/mode/toml/index.html