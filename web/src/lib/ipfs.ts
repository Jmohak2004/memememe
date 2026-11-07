/**
 * Pins JSON to IPFS via Pinata. Needs VITE_PINATA_JWT in web/.env (get one free at pinata.cloud).
 * Without the key it throws; callers fall back to browser-local storage.
 * NOTE: a JWT in a Vite env var ships to the browser. For production, proxy this through a serverless function.
 */
export async function ipfsUpload(json: string): Promise<string> {
  const jwt = import.meta.env.VITE_PINATA_JWT;
  if (!jwt) throw new Error("VITE_PINATA_JWT not set");
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ pinataContent: JSON.parse(json) }),
  });
  if (!res.ok) throw new Error(`pinata ${res.status}`);
  return (await res.json()).IpfsHash as string;
}
