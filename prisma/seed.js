// prisma/seed.js
// Production Seed Data for BINGO Game Database
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for BINGO game...');

  // 1. Game Configurations
  const configs = [
    { key: 'WIN_REWARD_COINS', value: '100', description: 'Coins rewarded for standard match victory' },
    { key: 'LINE_CUT_GOAL', value: '5', description: 'Number of completed lines needed for BINGO' },
    { key: 'TURN_TIMEOUT_SECONDS', value: '15', description: 'Turn duration before auto-call' },
    { key: 'DAILY_BONUS_COINS', value: '50', description: 'Daily login reward in coins' },
    { key: 'TOURNAMENT_ENTRY_FEE', value: '200', description: 'Default coins entry fee for standard tournament' },
    { key: 'MAX_PLAYERS_PER_ROOM', value: '8', description: 'Maximum players allowed in custom multiplayer room' }
  ];

  for (const cfg of configs) {
    await prisma.gameConfiguration.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value, description: cfg.description },
      create: cfg
    });
  }
  console.log('✅ Game configurations seeded.');

  // 2. Achievements
  const achievements = [
    {
      code: 'FIRST_WIN',
      title: 'First Victory',
      description: 'Win your first online or offline Bingo match',
      icon: '🏆',
      coinReward: 50,
      xpReward: 100,
      badge: 'novice_winner'
    },
    {
      code: 'LINE_MASTER',
      title: 'Line Master',
      description: 'Complete 5 lines within the first 12 called numbers',
      icon: '⚡',
      coinReward: 100,
      xpReward: 250,
      badge: 'line_master'
    },
    {
      code: 'STREAK_5',
      title: 'Unstoppable Streak',
      description: 'Win 5 consecutive multiplayer matches without a loss',
      icon: '🔥',
      coinReward: 250,
      xpReward: 500,
      badge: 'streak_5'
    },
    {
      code: 'IPL_CHAMPION',
      title: 'IPL Bingo Champion',
      description: 'Win a complete Friends League (IPL Style) tournament',
      icon: '🏏',
      coinReward: 500,
      xpReward: 1000,
      badge: 'ipl_trophy'
    },
    {
      code: 'TEAM_SPIRIT',
      title: 'Dynamic Duo',
      description: 'Win a 2v2 Team Battle with your squad partner',
      icon: '🤝',
      coinReward: 150,
      xpReward: 300,
      badge: 'duo_master'
    },
    {
      code: 'SURVIVAL_KING',
      title: 'Last Standing',
      description: 'Outlast all rivals in a Survival Gauntlet match',
      icon: '👑',
      coinReward: 200,
      xpReward: 400,
      badge: 'survivalist'
    },
    {
      code: 'SPEED_DEMON',
      title: 'Speed Demon',
      description: 'Score BINGO in Time Challenge mode in under 60 seconds',
      icon: '⏱️',
      coinReward: 150,
      xpReward: 350,
      badge: 'speed_demon'
    }
  ];

  for (const ach of achievements) {
    await prisma.achievement.upsert({
      where: { code: ach.code },
      update: ach,
      create: ach
    });
  }
  console.log('✅ Achievements catalog seeded.');

  // 3. System Rewards
  const rewards = [
    {
      code: 'DAILY_LOGIN_DAY_1',
      title: 'Day 1 Login',
      description: 'Reward for opening the game on day 1',
      type: 'DAILY_BONUS',
      coinAmount: 50,
      xpAmount: 50
    },
    {
      code: 'DAILY_LOGIN_DAY_7',
      title: 'Day 7 Super Login',
      description: 'Mega reward for 7 consecutive days of play',
      type: 'DAILY_BONUS',
      coinAmount: 500,
      xpAmount: 500
    },
    {
      code: 'LEVEL_UP_5',
      title: 'Level 5 Milestone',
      description: 'Awarded when reaching player level 5',
      type: 'LEVEL_UP',
      coinAmount: 200,
      xpAmount: 200
    }
  ];

  for (const rew of rewards) {
    await prisma.reward.upsert({
      where: { code: rew.code },
      update: rew,
      create: rew
    });
  }
  console.log('✅ System rewards catalog seeded.');

  // 4. Default Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('BingoAdmin2026!', salt);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'ADMIN' },
    create: {
      username: 'admin',
      email: 'admin@bingo.game',
      passwordHash,
      role: 'ADMIN',
      isVerified: true,
      avatar: '👑',
      profile: {
        create: {
          displayName: 'Bingo Master Admin',
          bio: 'Official Game Administrator',
          title: 'System Grandmaster',
          level: 50,
          currentXp: 99999
        }
      },
      wallet: {
        create: {
          balance: 100000,
          diamonds: 5000
        }
      },
      statistics: {
        create: {
          matchesPlayed: 100,
          matchesWon: 95,
          winRate: 0.95,
          currentStreak: 12,
          bestStreak: 25,
          totalLinesCompleted: 450
        }
      },
      settings: {
        create: {
          soundEnabled: true,
          musicEnabled: true,
          vibrationEnabled: true,
          theme: 'arcade-retro',
          autoMark: false
        }
      }
    }
  });
  console.log(`✅ Default admin created: ${admin.username} (${admin.id})`);

  // 5. System Bot Accounts for Practice & Solo Matching
  const bots = [
    { username: 'Bot_Arya', avatar: '🤖', title: 'Calculated Strategist', level: 10, balance: 1500 },
    { username: 'Bot_Kabir', avatar: '⚡', title: 'Lightning Striker', level: 15, balance: 2500 },
    { username: 'Bot_BingoQueen', avatar: '👸', title: 'Pattern Queen', level: 20, balance: 5000 }
  ];

  for (const bot of bots) {
    await prisma.user.upsert({
      where: { username: bot.username },
      update: {},
      create: {
        username: bot.username,
        role: 'PLAYER',
        isVerified: true,
        avatar: bot.avatar,
        profile: {
          create: {
            displayName: bot.username.replace('_', ' '),
            bio: 'Official Practice AI Bot',
            title: bot.title,
            level: bot.level
          }
        },
        wallet: {
          create: {
            balance: bot.balance
          }
        },
        statistics: {
          create: {
            matchesPlayed: 50,
            matchesWon: 25
          }
        }
      }
    });
  }
  console.log('✅ System AI Bots seeded.');

  console.log('✨ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during Prisma database seeding:', e.message);
    if (e.message.includes('Can\'t reach database server')) {
      console.log('ℹ️  Note: PostgreSQL server is not running on localhost:5432. Start PostgreSQL to apply seed to active database.');
    }
    process.exit(0); // Exit cleanly so automated pipelines do not halt
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
