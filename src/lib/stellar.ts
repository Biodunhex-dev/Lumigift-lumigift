import {
  Horizon,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import { serverConfig } from "@/server/config";
import { logger } from "@/lib/logger";
import type { StellarAccount, StellarBalance } from "@/types";

const server = new Horizon.Server(serverConfig.stellar.horizonUrl);

const USDC = new Asset(serverConfig.usdc.assetCode, serverConfig.usdc.issuer);

const networkPassphrase =
  serverConfig.stellar.network === "mainnet"
    ? Networks.PUBLIC
    : Networks.TESTNET;

/**
 * Derives and returns the server's Stellar public key from the configured secret.
 * Emits an audit log entry so key rotations are traceable in the log stream.
 */
export function getServerPublicKey(): string {
  const keypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const publicKey = keypair.publicKey();
  logger.info(
    { event: "stellar_key_loaded", publicKey },
    "Stellar server signing key loaded"
  );
  return publicKey;
}

/**
 * Emits a structured audit log entry recording a key rotation event.
 * Call this after successfully deploying a new signing key.
 *
 * @param oldPublicKey - The public key of the rotated-out key.
 * @param newPublicKey - The public key of the newly active key.
 * @param rotatedBy - Identifier of the engineer or process that performed the rotation.
 */
export function auditLogKeyRotation(
  oldPublicKey: string,
  newPublicKey: string,
  rotatedBy: string
): void {
  logger.info(
    {
      event: "stellar_key_rotated",
      oldPublicKey,
      newPublicKey,
      rotatedBy,
      timestamp: new Date().toISOString(),
    },
    "STELLAR_SERVER_SECRET_KEY rotated"
  );
}

/**
 * Loads a Stellar account from Horizon and maps its balances to a typed shape.
 *
 * @param publicKey - The Stellar public key (G…) of the account to load.
 * @returns A {@link StellarAccount} with the account's sequence number and balances.
 * @throws {@link https://stellar.github.io/js-stellar-sdk/HorizonApi.ErrorResponseData.html | HorizonError}
 *   if the account does not exist on the network.
 */
export async function loadAccount(publicKey: string): Promise<StellarAccount> {
  const account = await server.loadAccount(publicKey);
  const balances: StellarBalance[] = account.balances.map((b) => ({
    assetCode: b.asset_type === "native" ? "XLM" : (b as { asset_code: string }).asset_code,
    assetIssuer:
      b.asset_type !== "native" ? (b as { asset_issuer: string }).asset_issuer : undefined,
    balance: b.balance,
  }));
  return { publicKey, sequence: account.sequence, balances };
}

/**
 * Returns the USDC balance for a Stellar account.
 * Returns `"0"` if the account has no USDC trustline or does not exist.
 *
 * @param publicKey - The Stellar public key (G…) of the account.
 * @returns The USDC balance as a decimal string (e.g. `"10.0000000"`).
 */
export async function getUsdcBalance(publicKey: string): Promise<string> {
  try {
    const account = await loadAccount(publicKey);
    const usdcBalance = account.balances.find(
      (b) => b.assetCode === serverConfig.usdc.assetCode
    );
    return usdcBalance?.balance ?? "0";
  } catch {
    return "0";
  }
}

/**
 * Builds and submits a USDC payment from the server escrow account to a recipient.
 *
 * @param destinationPublicKey - The recipient's Stellar public key (G…).
 * @param amount - The USDC amount to send as a decimal string (e.g. `"10.0000000"`).
 * @returns The transaction hash of the submitted payment.
 * @throws If the server account has insufficient USDC balance or the transaction fails.
 */
export async function sendUsdcPayment(
  destinationPublicKey: string,
  amount: string
): Promise<string> {
  const serverKeypair = Keypair.fromSecret(serverConfig.stellar.serverSecretKey);
  const sourceAccount = await server.loadAccount(serverKeypair.publicKey());

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: destinationPublicKey,
        asset: USDC,
        amount,
      })
    )
    .setTimeout(30)
    .build();

  tx.sign(serverKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

/**
 * Establishes a USDC trustline for the account identified by `secretKey`.
 * Must be called before the account can hold or receive USDC.
 *
 * @param secretKey - The Stellar secret key (S…) of the account that will trust USDC.
 * @returns The transaction hash of the submitted change-trust operation.
 * @throws If the account has insufficient XLM to cover the base reserve or the
 *   transaction fails.
 */
export async function establishUsdcTrustline(secretKey: string): Promise<string> {
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

export { server as horizonServer, USDC, networkPassphrase };
