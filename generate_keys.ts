import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

async function generateVAPIDKeys() {
    const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
    );

    const publicKey = await crypto.subtle.exportKey("raw", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    const toBase64Url = (buf: ArrayBuffer) => {
        return btoa(String.fromCharCode(...new Uint8Array(buf)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
    };

    console.log("VAPID_PUBLIC_KEY:", toBase64Url(publicKey));
    console.log("VAPID_PRIVATE_KEY:", toBase64Url(privateKey));
}

generateVAPIDKeys();
