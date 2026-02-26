'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Phone,
  ExternalLink,
  Video,
  FileText,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  HelpCircle
} from 'lucide-react';

interface EducationalResource {
  id?: string;
  resource_type: 'article' | 'video' | 'tip' | 'helpline' | 'tool';
  category: string;
  title: string;
  description: string;
  content?: string;
  url?: string;
  risk_patterns?: string[];
  severity_level?: string[];
}

interface EducationalResourcesPanelProps {
  resources: EducationalResource[];
  insights?: any[];
}

export default function EducationalResourcesPanel({
  resources,
  insights = [],
}: EducationalResourcesPanelProps) {
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'article':
        return BookOpen;
      case 'video':
        return Video;
      case 'tip':
        return Lightbulb;
      case 'helpline':
        return Phone;
      case 'tool':
        return FileText;
      default:
        return HelpCircle;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'article':
        return 'teal';
      case 'video':
        return 'purple';
      case 'tip':
        return 'amber';
      case 'helpline':
        return 'red';
      case 'tool':
        return 'blue';
      default:
        return 'slate';
    }
  };

  const highPriorityResources = resources.filter(r =>
    r.resource_type === 'helpline' ||
    (insights.some(i => i.severity === 'concern') && r.severity_level?.includes('concern'))
  );

  const normalResources = resources.filter(r =>
    !highPriorityResources.includes(r)
  );

  const renderResource = (resource: EducationalResource, isPriority = false) => {
    const Icon = getIconForType(resource.resource_type);
    const color = getColorForType(resource.resource_type);
    const isExpanded = expandedResource === resource.id;

    return (
      <motion.div
        key={resource.id || resource.title}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          rounded-lg border overflow-hidden
          ${isPriority ? `bg-${color}-500/10 border-${color}-500/30` : `bg-slate-800/30 border-slate-700/50`}
        `}
      >
        <button
          onClick={() => setExpandedResource(isExpanded ? null : (resource.id || resource.title))}
          className="w-full p-4 text-left hover:bg-slate-800/20 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 bg-${color}-500/10 rounded-lg flex-shrink-0`}>
              <Icon className={`w-5 h-5 text-${color}-400`} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-white text-sm">
                  {resource.title}
                </h4>
                {isPriority && (
                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    Important
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                {resource.description}
              </p>
            </div>

            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </div>
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 border-t border-slate-700/50">
                {resource.content && (
                  <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                    {resource.content}
                  </p>
                )}

                {resource.url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`w-full border-${color}-500/30 hover:bg-${color}-500/10 text-${color}-400`}
                    onClick={() => window.open(resource.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Learn More
                  </Button>
                )}

                {resource.resource_type === 'helpline' && !resource.url && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                    <p className="text-red-400 font-semibold text-sm mb-1">
                      24/7 Helpline Available
                    </p>
                    <p className="text-slate-300 text-xs">
                      Call 0800 006 008 for free, confidential support
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  if (resources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/80 border-slate-800">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <h3 className="text-lg font-semibold text-white">
              Helpful Resources
            </h3>
          </div>

          <p className="text-sm text-slate-400">
            Based on your responses, here are some resources that might be helpful:
          </p>

          <div className="space-y-2">
            {highPriorityResources.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                  Priority Resources
                </h4>
                {highPriorityResources.map(resource => renderResource(resource, true))}
              </div>
            )}

            {normalResources.length > 0 && (
              <div className="space-y-2">
                {highPriorityResources.length > 0 && (
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4">
                    Additional Resources
                  </h4>
                )}
                {normalResources.map(resource => renderResource(resource))}
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-white text-sm mb-1">
                  Need More Support?
                </h4>
                <p className="text-xs text-slate-300 mb-3">
                  If you're concerned about your gambling or someone else's, free help is available.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-teal-500/30 hover:bg-teal-500/10 text-teal-400 text-xs"
                    onClick={() => window.open('https://www.responsiblegambling.co.za', '_blank')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Responsible Gambling SA
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/30 hover:bg-red-500/10 text-red-400 text-xs"
                    onClick={() => window.open('tel:0800006008', '_blank')}
                  >
                    <Phone className="w-3 h-3 mr-1" />
                    Call 0800 006 008
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
