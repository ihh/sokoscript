const int32ArrayToBase64String = (a) => {
    const buffer = new ArrayBuffer (a.length * 4);
    const view = new DataView (buffer);
    a.forEach ((x, n) => view.setInt32 (n*4, x));
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

const base64StringToInt32Array = (s) => {
    const buffer = Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
    const view = new DataView (buffer);
    return Array.from ({length:view.byteLength/4},(_x,n)=>view.getInt32(n*4));
};

export { int32ArrayToBase64String, base64StringToInt32Array };