async function check() {
  const res = await fetch('https://fullnode.testnet.sui.io:443', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getBalance',
      params: ['0x892d042d65d2440ae7801683f506646231aa6154ab0a9cf92e21bd0ecfd747df']
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data));
}
check();
