import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Globe,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Box,
} from 'lucide-react';
import { useState } from 'react';
import { analyzeUrl } from '../api/urlApi';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import Layout from '../components/Layout';

const FEATURES = [
  {
    icon: Globe,
    iconStyles: 'bg-blue-500/10 text-blue-400',
    title: 'URL Analysis',
    description: 'Extract and analyze URL features using advanced techniques.',
  },
  {
    icon: MapPin,
    iconStyles: 'bg-teal-500/10 text-teal-400',
    title: 'IP Intelligence',
    description: 'Get IP reputation, WHOIS, DNS, Geo-location and domain information.',
  },
  {
    icon: Shield,
    iconStyles: 'bg-purple-500/10 text-purple-400',
    title: 'Threat Intelligence',
    description: 'Check against VirusTotal, AbuseIPDB and multiple threat intelligence feeds.',
  },
  {
    icon: Box,
    iconStyles: 'bg-orange-500/10 text-orange-400',
    title: 'Blockchain Audit',
    description: 'Immutable audit logs using blockchain for transparency.',
  },
];

const STATS = [
  { icon: ShieldCheck, iconColor: 'text-teal-400', value: '12,458', label: 'URLs Analyzed', trend: '18.6% this week' },
  { icon: Bug, iconColor: 'text-red-400', value: '2,341', label: 'Threats Detected', trend: '22.4% this week' },
  { icon: CheckCircle2, iconColor: 'text-green-400', value: '9,812', label: 'Safe URLs', trend: '16.2% this week' },
  { icon: AlertTriangle, iconColor: 'text-yellow-400', value: '1,106', label: 'Malicious URLs', trend: '20.8% this week' },
];

// Home page: URL analysis portal. Matches Week 1 mockup — hero + search bar,
// feature highlights, and platform stats. Wiring to the real backend (and the
// Analysis Results Dashboard it should navigate to) lands in a later week.
export default function Home() {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    try {
      await analyzeUrl(url);
      // TODO: navigate to the Analysis Results Dashboard once it exists.
    } catch (error) {
      console.error('URL analysis failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
            Detect <span className="text-teal-400">Malicious URLs.</span>
            <br />
            Stay Protected.
          </h1>
          <p className="mt-6 max-w-xl text-slate-400">
            Advanced ML, Threat Intelligence and Blockchain Technology working
            together to identify and prevent URL based attacks in real-time.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Input
                icon={Globe}
                type="text"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Enter URL to analyze (e.g., https://example.com)"
                className="py-3"
              />
            </div>
            <Button type="submit" disabled={isSubmitting} className="sm:px-6">
              <Search className="h-4 w-4" />
              {isSubmitting ? 'Analyzing...' : 'Analyze URL'}
            </Button>
          </form>

          <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-teal-500" />
            We never store or share your submitted URLs.
          </p>
        </div>

        <div className="hidden justify-center lg:flex">
          <div className="flex h-64 w-64 items-center justify-center rounded-full bg-gradient-to-br from-teal-500/20 to-indigo-500/20">
            <div className="flex h-40 w-40 items-center justify-center rounded-full bg-slate-900 shadow-inner shadow-black/40">
              <ShieldCheck className="h-20 w-20 text-teal-400" />
            </div>
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, iconStyles, title, description }) => (
            <Card key={title}>
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${iconStyles}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-white">{title}</h3>
              <p className="text-sm text-slate-400">{description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Platform stats */}
      <section className="border-t border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ icon: Icon, iconColor, value, label, trend }) => (
            <div key={label} className="flex items-center gap-4">
              <Icon className={`h-8 w-8 shrink-0 ${iconColor}`} />
              <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="text-xs text-teal-400">↑ {trend}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-slate-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} URLShield AI. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-slate-300">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-slate-300">
              Terms of Use
            </a>
            <a href="#" className="hover:text-slate-300">
              Disclaimer
            </a>
          </div>
        </div>
      </footer>
    </Layout>
  );
}
