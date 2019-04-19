function check_login() {
    var form = document.forms["login"];
    var username = form.username.value;
    var password = form.password.value;

    if (username === null || username.length === 0) {
        document.getElementById("login").innerHTML = "Please enter your username!";
        return false;
    }
    if (password === null || password.length === 0) {
        document.getElementById("login").innerHTML = "Please enter your password!";
        return false;
    }

    // Add other checks: e.g. no space in username, no special character, etc.
    if (validator.contains(username, ' ')) {
        document.getElementById("login").innerHTML = "Invalid username (contains space)!";
        return false;
    }
    if (!validator.isAscii(username)) {
        document.getElementById("login").innerHTML = "Invalid username (contains special character)!";
        return false;
    }
    console.log(username.length);
    if (username.length >= 16 || username.length <= 4) {
        document.getElementById("login").innerHTML = "Invalid username (length is less than 4 or greater than 16)!";
        return false;
    }
    // check password
    if (validator.contains(password, ' ')) {
        document.getElementById("login").innerHTML = "Invalid password (contains space)!";
        return false;
    }
    if (!validator.isAscii(password)) {
        document.getElementById("login").innerHTML = "Invalid password (contains special character)!";
        return false;
    }
    if (password.length >= 16 || password.length <= 6) {
        document.getElementById("login").innerHTML = "Invalid password (length is less than 6 or greater than 16)!";
        return false;
    }
    return true;
}

function check_signup() {
    var form = document.forms["signup"];
    var username = form.username.value;
    var password = form.password.value;
    var realname = form.realname.value;
    var email = form.email.value;

    if (username === null || username.length === 0) {
        document.getElementById("signup").innerHTML = "Please enter your username!";
        return false;
    }
    if (password === null || password.length === 0) {
        document.getElementById("signup").innerHTML = "Please enter your password!";
        return false;
    }
    if (realname === null || realname.length === 0) {
        document.getElementById("signup").innerHTML = "Please enter your real name!";
        return false;
    }
    if (email === null || email.length === 0) {
        document.getElementById("signup").innerHTML = "Please enter your email!";
        return false;
    }

    // Add other checks: e.g. no space in username, no special character, etc.
    // email need has @ in it, real name can have special characer and space
    // check username
    if (validator.contains(username, ' ')) {
        document.getElementById("signup").innerHTML = "Invalid username (contains space)!";
        return false;
    }
    if (!validator.isAscii(username)) {
        document.getElementById("signup").innerHTML = "Invalid username (contains special character)!";
        return false;
    }
    if (username.length >= 16 || username.length <= 4) {
        document.getElementById("signup").innerHTML = "Invalid username (length is less than 4 or greater than 16)!";
        return false;
    }
    // check password
    if (validator.contains(password, ' ')) {
        document.getElementById("signup").innerHTML = "Invalid password (contains space)!";
        return false;
    }
    if (!validator.isAscii(password)) {
        document.getElementById("signup").innerHTML = "Invalid password (contains special character)!";
        return false;
    }
    if (password.length >= 16 || password.length <= 6) {
        document.getElementById("signup").innerHTML = "Invalid password (length is less than 6 or greater than 16)!";
        return false;
    }
    // check email
    if (!validator.isEmail(email)) {
        document.getElementById("signup").innerHTML = "Invalid Email!";
        return false;
    }
    // check realname
    if (realname.length <= 4 || realname.length >= 50) {
        document.getElementById("signup").innerHTML = "Invalid Name (length is less than 4 or greater than 50)!";
        return false;
    }

    return true;
}
