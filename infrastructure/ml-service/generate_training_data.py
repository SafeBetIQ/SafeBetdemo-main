import pandas as pd
import numpy as np
import random

np.random.seed(42)
random.seed(42)

n_players = 250

game_types = ['slots', 'roulette', 'blackjack', 'poker', 'baccarat']

data = []

for i in range(n_players):
    visits = np.random.randint(1, 200)

    base_bet = np.random.uniform(10, 5000)
    total_bet = base_bet * visits * np.random.uniform(0.5, 2.5)
    avg_bet_size = total_bet / visits if visits > 0 else 0

    rtp = np.random.uniform(0.75, 0.98)
    winnings = total_bet * rtp

    withdrawal_rate = np.random.uniform(0.3, 0.9)
    withdrawals = winnings * withdrawal_rate

    session_minutes = np.random.uniform(15, 240)

    game_type = random.choice(game_types)

    risky_behavior = 0
    if visits > 100 or session_minutes > 180 or avg_bet_size > 1000:
        risky_behavior = np.random.choice([0, 1], p=[0.3, 0.7])
    else:
        risky_behavior = np.random.choice([0, 1], p=[0.9, 0.1])

    risk_score = 0

    if visits > 150:
        risk_score += 20
    elif visits > 100:
        risk_score += 15
    elif visits > 50:
        risk_score += 10
    else:
        risk_score += 5

    if avg_bet_size > 2000:
        risk_score += 25
    elif avg_bet_size > 1000:
        risk_score += 18
    elif avg_bet_size > 500:
        risk_score += 12
    else:
        risk_score += 5

    if session_minutes > 180:
        risk_score += 20
    elif session_minutes > 120:
        risk_score += 15
    elif session_minutes > 60:
        risk_score += 10
    else:
        risk_score += 5

    net_loss = total_bet - withdrawals
    loss_ratio = net_loss / total_bet if total_bet > 0 else 0

    if loss_ratio > 0.5:
        risk_score += 20
    elif loss_ratio > 0.3:
        risk_score += 15
    elif loss_ratio > 0.1:
        risk_score += 10
    else:
        risk_score += 5

    if risky_behavior == 1:
        risk_score += 15

    risk_score = min(100, max(0, risk_score + np.random.randint(-5, 6)))

    if risk_score >= 80:
        risk_label = 'CRITICAL'
    elif risk_score >= 60:
        risk_label = 'HIGH'
    elif risk_score >= 40:
        risk_label = 'MEDIUM'
    else:
        risk_label = 'LOW'

    data.append({
        'player_id': f'PLR{str(i+1).zfill(6)}',
        'visits': visits,
        'total_bet': round(total_bet, 2),
        'avg_bet_size': round(avg_bet_size, 2),
        'winnings': round(winnings, 2),
        'withdrawals': round(withdrawals, 2),
        'session_minutes': round(session_minutes, 2),
        'game_type': game_type,
        'risky_behavior': risky_behavior,
        'risk_score': risk_score,
        'risk_label': risk_label
    })

df = pd.DataFrame(data)

print(f"Generated {len(df)} training samples")
print(f"\nRisk Label Distribution:")
print(df['risk_label'].value_counts())
print(f"\nGame Type Distribution:")
print(df['game_type'].value_counts())
print(f"\nRisky Behavior Distribution:")
print(df['risky_behavior'].value_counts())
print(f"\nRisk Score Statistics:")
print(df['risk_score'].describe())

df.to_csv('/tmp/cc-agent/60593674/project/ml-service/training_data.csv', index=False)
print(f"\nTraining data saved to training_data.csv")
