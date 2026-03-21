'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { cn } from '@aiready/components';
import { FileCode, BookOpen, Menu, X, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Header() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDocs = pathname?.startsWith('/docs');
  const isBlog = pathname?.startsWith('/blog');

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  const navLinks = [
    {
      href: '/docs',
      label: 'Docs',
      icon: FileCode,
      active: isDocs,
      color: 'blue',
    },
    {
      href: '/blog',
      label: 'Blog',
      icon: BookOpen,
      active: isBlog,
      color: 'purple',
    },
    {
      href: 'https://www.npmjs.com/package/@aiready/cli',
      label: 'Unified CLI',
      external: true,
      mobileOnly: false,
      desktopHidden: 'lg:block',
    },
    {
      href: 'https://marketplace.visualstudio.com/items?itemName=pengcao.aiready',
      label: 'VS Code',
      external: true,
      mobileOnly: false,
      desktopHidden: 'md:block',
    },
    {
      href: 'https://platform.getaiready.dev/login',
      label: 'Sign In',
      external: true,
      mobileOnly: false,
      desktopHidden: '',
    },
  ];

  return (
    <motion.header
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-zinc-800/50 shadow-sm"
    >
      <nav className="container mx-auto px-4 py-2 flex items-center justify-between relative">
        <Link href="/">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className={cn(
              'flex items-center gap-2 flex-shrink-0 transition-all duration-300 relative z-[60]',
              !isBlog && !isDocs && 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]'
            )}
          >
            <Image
              src="/logo-text-transparent.png"
              alt="AIReady Logo"
              width={210}
              height={48}
              className="h-8 sm:h-10 md:h-12 w-auto dark:hidden"
              priority
            />
            <Image
              src="/logo-text-dark.png"
              alt="AIReady Logo"
              width={210}
              height={48}
              className="h-8 sm:h-10 md:h-12 w-auto hidden dark:block"
              priority
            />
          </motion.div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-4 md:gap-6 lg:gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              className={cn(
                'items-center gap-1.5 text-sm md:text-base font-medium transition-colors relative group',
                link.desktopHidden || 'flex',
                link.active
                  ? link.color === 'blue'
                    ? 'glow-blue'
                    : 'glow-purple'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                !link.active &&
                  (link.color === 'purple'
                    ? 'hover:glow-purple'
                    : 'hover:glow-blue')
              )}
            >
              {link.icon && <link.icon className="w-4 h-4" />}
              <span>{link.label}</span>
              <span
                className={cn(
                  'absolute left-0 -bottom-1 h-0.5 transition-all duration-300',
                  link.color === 'purple'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600',
                  link.active ? 'w-full' : 'w-0 group-hover:w-full'
                )}
              ></span>
            </Link>
          ))}

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="#get-started"
              className="px-3 py-2 sm:px-4 sm:py-2.5 md:px-5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm sm:text-base font-bold rounded-lg hover:shadow-lg transition-all whitespace-nowrap"
            >
              Get Started
            </Link>
          </motion.div>
        </div>

        {/* Mobile Toggle */}
        <div className="flex sm:hidden items-center gap-3 relative z-[60]">
          <Link
            href="#get-started"
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-xs font-bold rounded-md"
          >
            Get Started
          </Link>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 sm:hidden"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[80%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl z-50 sm:hidden flex flex-col pt-20"
              >
                <div className="flex flex-col px-6 space-y-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      className={cn(
                        'flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-lg font-semibold',
                        link.active
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {link.icon && <link.icon size={20} />}
                        <span>{link.label}</span>
                      </div>
                      {link.external && (
                        <ExternalLink size={16} className="opacity-50" />
                      )}
                    </Link>
                  ))}
                </div>

                <div className="mt-auto p-6 border-t dark:border-slate-800">
                  <p className="text-xs text-slate-500 mb-4 text-center">
                    AIReady monorepo version v0.9.x
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <Link
                      href="https://github.com/caopengau/aiready-cli"
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      GitHub
                    </Link>
                    <span className="text-slate-300">•</span>
                    <Link
                      href="https://twitter.com/aireadytools"
                      className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      Twitter
                    </Link>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
    </motion.header>
  );
}
