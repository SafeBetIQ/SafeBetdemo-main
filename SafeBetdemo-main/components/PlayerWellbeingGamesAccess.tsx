'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Gamepad2,
  Clock,
  Target,
  Heart,
  Shield,
  Play,
  CheckCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const FEATURED_GAMES = [
  {
    name: 'Balance Journey',
    description: 'Test your decision-making skills with resource management',
    duration: 5,
    icon: Target,
    difficulty: 'Easy',
    benefits: ['Decision making', 'Risk awareness'],
  },
  {
    name: 'Impulse Challenge',
    description: 'Practice self-control and impulse management',
    duration: 8,
    icon: Shield,
    difficulty: 'Medium',
    benefits: ['Self-control', 'Impulse awareness'],
  },
  {
    name: 'Gem Runner',
    description: 'Fast-paced game testing quick decision skills',
    duration: 6,
    icon: Gamepad2,
    difficulty: 'Easy',
    benefits: ['Quick thinking', 'Pattern recognition'],
  },
];

export function PlayerWellbeingGamesAccess() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Gamepad2 className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">Wellbeing Check-In Games</h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Quick, fun games that help you understand your gaming behaviors and maintain healthy habits.
          Completely confidential and designed to support your wellbeing.
        </p>
      </div>

      {/* Why Play Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Why Play These Games?
          </CardTitle>
          <CardDescription>
            Understanding your behavior helps you stay in control
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CheckCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Self-Awareness</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Understand your decision-making patterns and risk tolerance
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Early Support</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Get personalized recommendations before problems develop
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Quick & Fun</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Each game takes only 5-10 minutes to complete
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Confidential</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Your responses are private and help you stay in control
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Featured Games */}
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURED_GAMES.map((game, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <game.icon className="h-6 w-6 text-primary" />
                </div>
                <Badge variant="outline">{game.difficulty}</Badge>
              </div>
              <CardTitle className="text-lg mt-4">{game.name}</CardTitle>
              <CardDescription className="text-sm">{game.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{game.duration} minutes</span>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Benefits:</p>
                <div className="flex flex-wrap gap-1">
                  {game.benefits.map((benefit, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {benefit}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={() => router.push('/wellbeing-game')}>
                <Play className="mr-2 h-4 w-4" />
                Play Now
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom CTA */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <h3 className="text-xl font-semibold">Ready to Get Started?</h3>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Choose any game above to begin your wellbeing check-in. Your insights help you maintain
              healthy gaming habits and stay in control.
            </p>
            <Button size="lg" onClick={() => router.push('/wellbeing-game')}>
              <Play className="mr-2 h-5 w-5" />
              Start Wellbeing Check-In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
