/**
 * Make an XMLHttpRequest for JSON data.
 * @param address Address to request from
 * @param callback function with (data, error) parameters to call after the request.
 */
function request(address, callback) {
    setTimeout(function () {
        var xhttp = new XMLHttpRequest();
        xhttp.responseType = 'arraybuffer';
        xhttp.onload = function (e) {
            if (this.status === 200) {
                var bytes = new Uint8Array(this.response);
                callback(bytes, null);
            }
        };
        // xhttp.onreadystatechange = function () {
        //     if (this.readyState === 4) {
        //         try {
        //             if (this.status === 200 || (this.status === 0 && this.responseText)) {
        //                 setTimeout(function () {
        //                     callback(new Uint8Array(this.response), null)
        //                 }, 0);
        //             } else if (this.status === 404 || this.status === 403 || this.status === 500) {
        //                 callback(null, "HTTP " + this.status + " (See " + address + ")")
        //             } else if (this.status === 400) {
        //                 callback(null, this.responseText + " (See " + address + ")")
        //             } else if (this.status === 0) {
        //                 callback(null, "Request was blocked. (Adblocker maybe?)")
        //             }
        //         } catch (e) {
        //             callback(null, e.message + " (See " + address + ")")
        //         }
        //     }
        // };
        xhttp.timeout = 45000;
        xhttp.ontimeout = function () {
            callback(null, "Timed out after 45 seconds. (" + address + ")")
        };
        xhttp.open("GET", address, true);
        xhttp.send();
    }, 0);
}