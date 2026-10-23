// Local network: find the classroom IP, announce a friendly name (mDNS) and print how to join.
import os from 'node:os';
import multicastDns from 'multicast-dns';
import type { Logger } from '../logger';

// Adapters that never reach the classroom PCs. VirtualBox on Windows is called "Ethernet 2" or similar,
// which is why its usual 192.168.56.x range is ruled out too.
const VIRTUAL_NAME = /virtualbox|vbox|vmware|vethernet|wsl|docker|hyper-v|loopback|tailscale|zerotier/i;
const MDNS_TTL_S = 120;

function virtualReason(name: string, ip: string): string | null {
  if (VIRTUAL_NAME.test(name)) return 'adaptador virtual';
  if (ip.startsWith('192.168.56.')) return 'red de VirtualBox';
  if (ip.startsWith('169.254.')) return 'sin DHCP, no tiene red';
  return null;
}

export function findLanAddress(): string | undefined {
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const i of addrs ?? []) {
      if (i.family === 'IPv4' && !i.internal && !virtualReason(name, i.address)) return i.address;
    }
  }
  return undefined;
}

/** Answers mDNS queries for `host` with `ip`. If it fails, the IP is still printed as a fallback. */
export function announce(host: string, ip: string, log: Logger): void {
  try {
    const mdns = multicastDns();
    mdns.on('query', (q) => {
      // The typings omit the ANY query type, which real clients do send
      const asksForHost = q.questions.some((x) => {
        const type: string = x.type;
        return x.name.toLowerCase() === host && (type === 'A' || type === 'ANY');
      });
      if (asksForHost) {
        mdns.respond({ answers: [{ name: host, type: 'A', ttl: MDNS_TTL_S, data: ip }] });
      }
    });
    mdns.on('error', (err: Error) => log.debug({ err }, 'mdns error'));
  } catch (err) {
    log.debug({ err }, 'mdns unavailable');
  }
}

export function printBanner(port: number, host: string, ip: string | undefined): void {
  // Plain console output on purpose: it is what the teacher reads to share the address
  const lines = ['', '  BLOCKSHOT en marcha', '', `  Tú:         http://localhost:${port}`];
  if (ip) {
    lines.push(`  La clase:   http://${host}:${port}`, `              (si no carga: http://${ip}:${port})`);
  } else {
    lines.push('', '  No se encontró ninguna red. ¿Estás conectado al wifi o al cable de la clase?');
  }
  console.log(`${lines.join('\n')}\n`);
}
