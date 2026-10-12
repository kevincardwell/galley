import nacl from "tweetnacl";
import { blake2b } from "blakejs";

const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

/**
 * libsodium's crypto_box_seal, which is what GitHub wants for Actions secrets: a throwaway key pair
 * encrypts the message to the repository's public key, and only GitHub can open it.
 * Layout: ephemeral public key || box(message, nonce = blake2b(ephemeral pk || recipient pk, 24 bytes)).
 */
export function sealedBox(message: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  const eph = nacl.box.keyPair();
  const nonce = blake2b(concat(eph.publicKey, recipientPublicKey), undefined, nacl.box.nonceLength);
  return concat(eph.publicKey, nacl.box(message, nonce, recipientPublicKey, eph.secretKey));
}
