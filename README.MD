# Rust-IDE
#### Brackets extension Rust-IDE
----

This Brackets extension needs racer to complete code. After install racer correctly, open the Rust-IDE Settings dialog from File Menu, set the correct racer path.

Get ``racer`` here: 
https://github.com/phildawes/racer

#### Features

##### Lint (experimental)
Lint use `rustc -Zno-trans` and `cargo rustc -Zno-trans`, so ensure you have `rustc` and `cargo` in your system path.

##### Code Hint
![Rust-IDE](https://raw.githubusercontent.com/rrandom/Brackets-Rust-IDE/master/images/code-hint.png)

##### Quick Edit
![Rust-IDE](https://raw.githubusercontent.com/rrandom/Brackets-Rust-IDE/master/images/quick-edit.png)



#### NOTE
quick-edit now search function endline based on your rust code indentation, the result maybe inaccurate.


#### Credits
- [David5i6](https://github.com/David5i6/Brackets-Go-IDE)
- [mackenza](https://github.com/mackenza/Brackets-PHP-SmartHints)
- [JSUtils](https://github.com/adobe/brackets/blob/5ef84133cb8c5acdcb7e80b85bbee86f65c2c9b1/src/language/JSUtils.js)
- [phoenix3008](https://github.com/phoenix3008/brackets-phplinter)