import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';
import { ENGRAM_REGISTRY_ABI } from '../src/lib/registry/abi';

const require = createRequire(import.meta.url);

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = rawValue.replace(/^["']|["']$/g, '');
  }
}

function compileContract() {
  const solc = require('solc');
  const sourcePath = resolve(process.cwd(), 'contracts/EngramRegistry.sol');
  const source = readFileSync(sourcePath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'EngramRegistry.sol': { content: source },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['evm.bytecode.object'],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors ?? []).filter((error: { severity: string }) => error.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((error: { formattedMessage: string }) => error.formattedMessage).join('\n'));
  }

  const bytecode = output.contracts?.['EngramRegistry.sol']?.EngramRegistry?.evm?.bytecode?.object;
  if (!bytecode) throw new Error('Solidity compile did not produce EngramRegistry bytecode');

  return `0x${bytecode}`;
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env'));
  loadEnvFile(resolve(process.cwd(), '.env.local'));

  const rpc = process.env.NEXT_PUBLIC_L1_RPC || 'https://evmrpc-testnet.0g.ai';
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY is required to deploy EngramRegistry');

  const provider = new JsonRpcProvider(rpc);
  const wallet = new Wallet(privateKey, provider);
  const bytecode = compileContract();
  const factory = new ContractFactory(ENGRAM_REGISTRY_ABI, bytecode, wallet);

  console.log(`Deploying EngramRegistry from ${wallet.address} to ${rpc}...`);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployment = contract.deploymentTransaction();
  console.log(`EngramRegistry deployed: ${address}`);
  if (deployment) console.log(`Deployment tx: ${deployment.hash}`);
  console.log(`Set NEXT_PUBLIC_ENGRAM_REGISTRY=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
