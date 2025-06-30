#!/usr/bin/env ts-node

import { config } from '@/config/environment';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

class SessionManager {
  private sessionPath: string;

  constructor() {
    this.sessionPath = this.resolveSessionPath();
  }

  private resolveSessionPath(): string {
    const sessionDir = path.join(process.cwd(), 'session');
    
    try {
      // Check if session directory exists
      const sessionDirs = fsSync.readdirSync(sessionDir, { withFileTypes: true })
        .filter((dirent: any) => dirent.isDirectory())
        .map((dirent: any) => dirent.name);
      
      // Look for existing session directory (prioritize ones with timestamp)
      const existingSession = sessionDirs.find((dir: string) => 
        dir.includes('arverid') || dir.includes('chatbot') || dir.includes('session')
      );
      
      if (existingSession) {
        console.log(`🔍 Found existing session: ${existingSession}`);
        return path.join(sessionDir, existingSession);
      }
      
      // If no existing session, use default
      console.log('⚠️ No existing session found');
      return path.join(sessionDir, config.whatsappSessionId);
      
    } catch (error) {
      // Fallback to default if directory doesn't exist
      console.log('📁 Session directory not found, using default');
      return path.join(sessionDir, config.whatsappSessionId);
    }
  }

  async getSessionInfo(): Promise<void> {
    console.log('📱 WhatsApp Session Manager');
    console.log('==========================\n');

    try {
      const credsPath = path.join(this.sessionPath, 'creds.json');
      
      try {
        await fs.access(credsPath);
        const stats = await fs.stat(credsPath);
        const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
        const ageInDays = ageInHours / 24;

        console.log('✅ Session found');
        console.log(`📁 Location: ${this.sessionPath}`);
        console.log(`⏰ Age: ${ageInHours.toFixed(1)} hours (${ageInDays.toFixed(1)} days)`);
        console.log(`📅 Last modified: ${stats.mtime.toLocaleString()}`);
        
        // Read session details
        const credsContent = await fs.readFile(credsPath, 'utf8');
        const creds = JSON.parse(credsContent);
        
        if (creds.me && creds.me.id) {
          console.log(`📞 Phone: ${creds.me.id.split(':')[0]}`);
          console.log(`👤 Name: ${creds.me.name || 'Not set'}`);
        }

        // Check session files
        const sessionFiles = await fs.readdir(this.sessionPath);
        const jsonFiles = sessionFiles.filter(f => f.endsWith('.json'));
        console.log(`📄 Session files: ${jsonFiles.length}`);

        // Determine session health
        if (ageInDays > 7) {
          console.log('\n⚠️  Session is older than 7 days - might need refresh');
        } else if (ageInDays > 3) {
          console.log('\n⚡ Session is a few days old - should work fine');  
        } else {
          console.log('\n✨ Session is fresh - should work perfectly');
        }

        console.log('\n💡 Tips:');
        console.log('- If you keep getting QR codes, the session might be expired');
        console.log('- Clear session if WhatsApp shows "Phone not connected" errors');
        console.log('- Sessions can expire if WhatsApp Web was used elsewhere');

      } catch (error) {
        console.log('❌ No session found');
        console.log('📝 You need to scan QR code to create a new session');
      }

    } catch (error) {
      console.error('Error checking session:', error);
    }
  }

  async clearSession(): Promise<void> {
    console.log('🧹 Clearing WhatsApp session...\n');

    try {
      const sessionFiles = await fs.readdir(this.sessionPath).catch(() => []);
      let filesRemoved = 0;

      for (const file of sessionFiles) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.sessionPath, file)).catch(() => {});
          filesRemoved++;
        }
      }

      console.log(`✅ Cleared ${filesRemoved} session files`);
      console.log('📱 Next connection will require QR code scan');
      
    } catch (error) {
      console.error('❌ Failed to clear session:', error);
    }
  }

  async validateSession(): Promise<boolean> {
    try {
      const credsPath = path.join(this.sessionPath, 'creds.json');
      
      await fs.access(credsPath);
      const credsContent = await fs.readFile(credsPath, 'utf8');
      const creds = JSON.parse(credsContent);
      
      return !!(creds.me && creds.me.id);
    } catch {
      return false;
    }
  }
}

async function main() {
  const manager = new SessionManager();
  const command = process.argv[2];

  switch (command) {
    case 'clear':
    case 'clean':
      await manager.clearSession();
      break;
    
    case 'check':
    case 'info':
    default:
      await manager.getSessionInfo();
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { SessionManager };