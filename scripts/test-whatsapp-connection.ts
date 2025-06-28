#!/usr/bin/env ts-node

import {
    DisconnectReason,
    fetchLatestBaileysVersion,
    default as makeWASocket,
    useMultiFileAuthState
} from '@whiskeysockets/baileys';
import * as fs from 'fs';
import * as path from 'path';
import qrcode from 'qrcode';

class WhatsAppConnectionTester {
  private sessionPath: string;
  private socket: any = null;

  constructor() {
    this.sessionPath = path.join(process.cwd(), 'test-session');
  }

  async testConnection(): Promise<void> {
    console.log('🔧 WHATSAPP CONNECTION DIAGNOSTIC');
    console.log('================================\n');

    try {
      // Step 1: Check network connectivity
      console.log('1️⃣ Testing network connectivity...');
      await this.testNetworkConnectivity();
      console.log('✅ Network connectivity OK\n');

      // Step 2: Check Baileys version
      console.log('2️⃣ Checking Baileys version...');
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`✅ Baileys version: ${JSON.stringify(version)}, Latest: ${isLatest}\n`);

      // Step 3: Clear any existing test session
      console.log('3️⃣ Clearing test session...');
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
      }
      fs.mkdirSync(this.sessionPath, { recursive: true });
      console.log('✅ Test session cleared\n');

      // Step 4: Test WhatsApp connection
      console.log('4️⃣ Testing WhatsApp connection...');
      await this.attemptConnection();

    } catch (error) {
      console.error('❌ Connection test failed:', error instanceof Error ? error.message : error);
      await this.cleanup();
    }
  }

  private async testNetworkConnectivity(): Promise<void> {
    const { default: fetch } = await import('node-fetch' as any) || require('axios');
    
    try {
      // Test basic internet connectivity
      const response = await fetch('https://www.google.com', { 
        timeout: 5000,
        method: 'HEAD'
      });
      
      if (!response.ok && response.status !== 200) {
        throw new Error(`Network test failed with status: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Network connectivity issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async attemptConnection(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let timeoutId: NodeJS.Timeout;
      let qrShown = false;

      try {
        // Set overall timeout
        timeoutId = setTimeout(() => {
          reject(new Error('Connection attempt timed out after 2 minutes'));
        }, 120000);

        // Load auth state
        const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

        // Create socket with minimal config for testing
        this.socket = makeWASocket({
          auth: state,
          logger: { 
            level: 'silent', 
            child: () => ({ level: 'silent' } as any)
          } as any,
          browser: ['Connection Test', 'Desktop', '1.0.0'],
          syncFullHistory: false,
          markOnlineOnConnect: false,
          connectTimeoutMs: 30000,
          defaultQueryTimeoutMs: 30000,
          keepAliveIntervalMs: 25000,
          getMessage: async () => undefined,
          shouldSyncHistoryMessage: () => false
        });

        // Handle connection updates
        this.socket.ev.on('connection.update', async (update: any) => {
          const { connection, lastDisconnect, qr } = update;

          console.log(`📱 Connection status: ${connection || 'unknown'}`);

          if (qr && !qrShown) {
            qrShown = true;
            console.log('\n📱 QR CODE READY!');
            console.log('================================');
            console.log('Scan this QR code with your WhatsApp:');
            console.log('1. Open WhatsApp on your phone');
            console.log('2. Go to Settings > Linked Devices');
            console.log('3. Tap "Link a Device"');
            console.log('4. Scan the QR code below:\n');

            try {
              // Generate QR code
              const qrString = await qrcode.toString(qr, { type: 'terminal', small: true });
              console.log(qrString);
              console.log('\n⏰ QR code expires in 60 seconds. Scan quickly!\n');
            } catch (qrError) {
              console.error('Failed to generate QR code:', qrError);
              console.log(`QR Data: ${qr}`);
            }
          }

          if (connection === 'open') {
            clearTimeout(timeoutId);
            console.log('🎉 WhatsApp connected successfully!');
            console.log('✅ Connection test PASSED\n');
            
            // Test sending a message to yourself
            await this.testMessageSending();
            resolve();
          }else{
            console.log(`🔄 Connection status: ${connection}`);
          }

          if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
            console.log(`❌ Connection closed. Status code: ${statusCode}`);
            
            // Analyze the disconnection reason
            this.analyzeDisconnectionReason(statusCode);
            
            clearTimeout(timeoutId);
            reject(new Error(`Connection closed with status: ${statusCode}`));
          }
        });

        // Handle credentials
        this.socket.ev.on('creds.update', saveCreds);

      } catch (error) {
        clearTimeout(timeoutId!);
        reject(error);
      }
    });
  }

  private analyzeDisconnectionReason(statusCode: number): void {
    console.log('\n🔍 DISCONNECTION ANALYSIS:');
    console.log('==========================');

    switch (statusCode) {
      case DisconnectReason.badSession:
        console.log('❌ Bad session - Clear session folder and try again');
        console.log('💡 Solution: rm -rf session/ && restart app');
        break;

      case DisconnectReason.connectionClosed:
        console.log('⚠️  Connection closed - Network issue or server problem');
        console.log('💡 Solution: Check internet connection, try different network');
        break;

      case DisconnectReason.connectionLost:
        console.log('⚠️  Connection lost - Temporary network issue');
        console.log('💡 Solution: Retry connection, check network stability');
        break;

      case DisconnectReason.connectionReplaced:
        console.log('❌ Connection replaced - Another device logged in');
        console.log('💡 Solution: Use only one device at a time');
        break;

      case DisconnectReason.loggedOut:
        console.log('❌ Logged out - Need to scan QR again');
        console.log('💡 Solution: Clear session and scan QR code again');
        break;

      case DisconnectReason.timedOut:
        console.log('⏰ Connection timed out');
        console.log('💡 Solution: Check network speed, try again');
        break;

      case 428:
        console.log('❌ Precondition Required - Session validation failed');
        console.log('💡 Solution: Clear session folder and scan QR again');
        break;

      case 515:
        console.log('❌ Stream Error - WebSocket connection failed');
        console.log('💡 Solutions:');
        console.log('   - Check if your ISP blocks WhatsApp Web');
        console.log('   - Try using VPN');
        console.log('   - Check firewall settings');
        console.log('   - Try different network (mobile hotspot)');
        break;

      default:
        console.log(`❓ Unknown status code: ${statusCode}`);
        console.log('💡 Solution: Try clearing session and restarting');
        break;
    }
  }

  private async testMessageSending(): Promise<void> {
    try {
      console.log('📤 Testing message sending...');
      
      // Send a test message to the connected number (yourself)
      const jid = this.socket.user.id;
      await this.socket.sendMessage(jid, { text: '🤖 Health Bot Connection Test - SUCCESS!' });
      
      console.log('✅ Test message sent successfully');
    } catch (error) {
      console.log('⚠️  Message sending test failed:', error instanceof Error ? error.message : error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.socket) {
        await this.socket.logout();
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up test session
    try {
      if (fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  async runNetworkDiagnostics(): Promise<void> {
    console.log('🌐 NETWORK DIAGNOSTICS');
    console.log('======================\n');

    const tests = [
      { name: 'Google DNS', host: '8.8.8.8', port: 53 },
      { name: 'WhatsApp Web', host: 'web.whatsapp.com', port: 443 },
      { name: 'Meta Servers', host: 'graph.facebook.com', port: 443 }
    ];

    for (const test of tests) {
      try {
        console.log(`Testing ${test.name}...`);
        const { default: net } = await import('net');
        
        await new Promise((resolve, reject) => {
          const socket = net.createConnection(test.port, test.host);
          socket.setTimeout(5000);
          
          socket.on('connect', () => {
            console.log(`✅ ${test.name}: Connected`);
            socket.destroy();
            resolve(void 0);
          });
          
          socket.on('error', (error) => {
            console.log(`❌ ${test.name}: Failed - ${error.message}`);
            reject(error);
          });
          
          socket.on('timeout', () => {
            console.log(`⏰ ${test.name}: Timeout`);
            socket.destroy();
            reject(new Error('Timeout'));
          });
        });
      } catch (error) {
        console.log(`❌ ${test.name}: ${error instanceof Error ? error.message : 'Failed'}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const tester = new WhatsAppConnectionTester();

  try {
    switch (command) {
      case 'network':
        await tester.runNetworkDiagnostics();
        break;
        
      case 'full':
        await tester.runNetworkDiagnostics();
        console.log('\n');
        await tester.testConnection();
        break;
        
      default:
        await tester.testConnection();
        break;
    }
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n💥 Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}