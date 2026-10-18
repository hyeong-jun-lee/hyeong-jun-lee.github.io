---
layout: post
title: "Imitation Learning 기초: Behavioral Cloning부터 DAgger까지"
description: "Behavioral Cloning과 DAgger의 정의 및 분석"
date: 2026-10-17 17:15:00 +0900
permalink: /blog/2026/dagger/
tags: [paper review, imitation learning, behavioral cloning, distribution shift, dataset aggregation]
categories: [imitation and intervention learning]
related_posts: true
giscus_comments: true
pretty_table: true
pseudocode: true
toc:
  sidebar: left
---

## Introduction

이번 포스트에서는 Behavioral Cloning(BC)의 오차 누적 문제와 이를 다루는 DAgger를 정리한다. Sergey Levine의 **CS 285, Fall 2023** 강의와 Ross, Gordon, Bagnell(2011)의 논문을 참고했다.

Imitation learning은 전문가(expert)의 행동을 이용해 정책(policy)을 학습하는 방법이다. 가장 단순한 방법인 **Behavioral Cloning**은 주어진 관측에서 전문가가 선택한 행동을 지도학습으로 예측한다.

제어 문제에서는 현재 행동이 다음 관측에 영향을 준다. 전문가 데이터에서 예측 오차가 작은 정책도 실행 중에는 실수로 인해 학습하지 않은 상태에 도달할 수 있다. 이러한 *distribution shift*는 이후의 오차를 키운다. DAgger는 학습 정책이 방문한 상태에서 전문가 행동을 수집하고, 이 데이터를 누적해 정책을 다시 학습한다.

---

## 1. Behavioral Cloning: imitation learning as supervised learning

전문가 정책을 $\pi^*$, 학습할 정책을 $\pi_\theta$로 둔다. 길이가 $T$인 전문가 시연(trajectory)을

$$
\tau^*=\bigl(s_1,a_1^*,s_2,a_2^*,\ldots,s_T,a_T^*\bigr),
\qquad a_t^*\sim\pi^*(\cdot\mid s_t)
$$

라고 하면, 데이터셋은 상태와 전문가 행동의 쌍으로 구성된다.

$$
\mathcal D_E=\left\{(s_i,a_i^*)\right\}_{i=1}^{M}.
$$

이후 지도학습으로 전문가 행동을 예측하는 정책을 학습한다. 연속 행동에서 제곱오차를 사용할 수 있고, 확률적 정책에서는 음의 로그우도(negative log-likelihood)를 사용할 수 있다.

$$
\mathcal L_{\mathrm{BC}}(\theta)
=\mathbb E_{(s,a^*)\sim\mathcal D_E}
\left[-\log\pi_\theta(a^*\mid s)\right].
$$

결정론적 정책과 제곱오차를 사용하는 경우에는 다음처럼 표현한다.

$$
\mathcal L_{\mathrm{BC}}(\theta)
=\mathbb E_{(s,a^*)\sim\mathcal D_E}
\left[\|\pi_\theta(s)-a^*\|_2^2\right].
$$

**관측과 상태의 구분.** 실제 로봇에서는 전체 상태 $s_t$를 알지 못하고 카메라 영상 등의 관측 $o_t$만 얻는 경우가 많다. 이때 정책은 $\pi_\theta(a_t\mid o_t)$의 형태가 된다. 아래 이론에서는 원 논문과 같이 $s$를 사용하지만, 관측만 사용하는 문제에서도 같은 분포 불일치 문제가 발생한다.

### 1.1 Task cost와 surrogate loss

모방학습에서 실제로 관심 있는 것은 전문가 행동의 예측 정확도만이 아니라, 정책을 실행했을 때의 성능이다. 상태 $s$에서 행동 $a$를 수행한 즉각 비용을 $C(s,a)\in[0,1]$라고 하자. 정책 $\pi$의 전체 기대 누적 비용은

$$
J(\pi)=\sum_{t=1}^{T}\mathbb E_{s\sim d_\pi^t,\,a\sim\pi(\cdot\mid s)}[C(s,a)]
$$

이다. 여기서 $d_\pi^t$는 처음부터 $\pi$를 실행했을 때 시점 $t$의 상태분포이며, 평균 상태분포는

$$
d_\pi=\frac1T\sum_{t=1}^{T}d_\pi^t
$$

로 정의한다.

실제 비용 $C(s,a)$를 직접 알기 어려우므로, 지도학습에서는 전문가 행동과의 차이를 측정하는 **대리 손실(surrogate loss)** $\ell(s,\pi)$을 사용한다. 따라서 BC가 최소화하는 목표는

$$
\boxed{\;
\hat\pi_{\mathrm{BC}}
=\arg\min_{\pi\in\Pi}
\mathbb E_{s\sim d_{\pi^*}}[\ell(s,\pi)]
\;}
$$

이다. $\Pi$는 정책 집합이며, BC의 손실은 **전문가의 상태분포** $d_{\pi^*}$에서 평가된다.

---

## 2. Distribution Shift

일반적인 지도학습에서는 학습 데이터와 테스트 데이터가 같은 분포에서 생성된다고 가정한다. BC에서는 전문가가 방문한 상태로 학습하지만, 실행 시에는 학습 정책이 자신의 행동으로 다음 상태를 결정한다. 따라서 두 상태분포가 달라질 수 있다.

$$
\underbrace{d_{\pi^*}}_{\text{전문가 시연에서 관측}}
\quad\neq\quad
\underbrace{d_{\pi_\theta}}_{\text{학습 정책을 실제 실행}}
$$

예를 들어 전문가가 장애물을 항상 왼쪽으로 안전하게 피했다면, 전문가 시연에는 장애물의 오른쪽에 바짝 접근한 상태가 거의 나타나지 않는다. 그러나 학습 정책이 한 번 잘못 조향하면 그러한 상태에 진입할 수 있다. 정책은 그 상태에서 복구하는 행동을 배우지 못했으므로 추가적인 오류를 발생시킬 수 있다.

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-12 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/levine-distribution-shift.png" class="img-fluid rounded" width="2460" height="1430" alt="전문가 궤적과 BC 정책의 궤적이 갈라지면서 학습과 실행의 관측분포가 달라지는 개념도." caption="can we make \(p_{\mathrm{data}}(\mathbf{o}_t) = p_{\pi_\theta}(\mathbf{o}_t)\)?<br>출처: <a href='https://rail.eecs.berkeley.edu/deeprlcourse-fa23/static/slides/lec-2.pdf#page=11'>Sergey Levine, CS 285 — Supervised Learning of Behaviors (Fall 2023)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

이 과정에서 **compounding error(오차 누적)**가 발생한다. 잘못된 행동이 미래 입력을 바꾸므로, 각 시점의 오류를 독립적인 실수로 계산할 수 없다.

---

## 3. BC의 O(εT²) 오차 누적

강의에서 다루는 $O(\epsilon T^2)$ 상한을 최초의 행동 불일치(first mistake)를 기준으로 유도한다. 각 시점의 오류가 독립이라는 가정은 필요하지 않다.

### 3.1 문제 설정

우선 분석을 단순하게 하기 위해 전문가 행동이 정해져 있는 상황을 가정한다. 시점 $t$에서 학습 정책이 전문가 행동과 다르면 1, 같으면 0의 비용을 부여한다.

$$
C(s,a)=\mathbf 1\{a\neq\pi^*(s)\}.
$$

전문가가 방문하는 시점 $t$의 상태에서 학습 정책이 실수할 확률을 $e_t$라 하고, 그 시간 평균을 $\epsilon$으로 정의한다.

$$
e_t=\Pr_{s\sim d_{\pi^*}^t}
\bigl[\pi_\theta(s)\neq\pi^*(s)\bigr],
\qquad
\epsilon=\frac1T\sum_{t=1}^{T}e_t.
$$

정의상 $\epsilon$은 학습 정책 자신의 상태분포에서 측정한 오류율이 아니라 **전문가 상태분포에서 측정한 오류율**이다.

### 3.2 최초 불일치 이후의 오차

학습 정책과 전문가를 동일한 초기 상태와 동일한 환경의 확률적 결과를 사용하여 비교한다고 하자. 두 정책이 같은 행동을 선택하는 동안에는 같은 궤적을 따른다. 시간 $t$에 처음으로 서로 다른 행동을 선택하면 이후에는 완전히 다른 상태를 방문할 수 있다.

$F_t$를 시간 $t$에 최초의 행동 불일치가 발생하는 사건으로 둔다. 이 사건은 전문가 궤적의 시점 $t$에서 행동을 잘못 선택하는 사건의 부분집합이므로

$$
\Pr(F_t)\le e_t
$$

이다. $F_t$가 발생하면 남은 $T-t+1$단계 동안 최악의 경우 매번 비용 1을 발생시킬 수 있다. 따라서

$$
\begin{aligned}
J(\pi_\theta)-J(\pi^*)
&\le\sum_{t=1}^{T}\Pr(F_t)(T-t+1)\\
&\le\sum_{t=1}^{T}e_t(T-t+1)\\
&\le T\sum_{t=1}^{T}e_t\\
&=\boxed{\epsilon T^2}.
\end{aligned}
$$

즉,

$$
\boxed{\;J(\pi_\theta)\le J(\pi^*)+T^2\epsilon\;}
$$

라는 최악의 경우 상한을 얻는다. 이는 Ross and Bagnell(2010), Ross et al.(2011)의 BC 분석과 일치하는 차수이다.

모든 시점에서 $e_t\le\epsilon$이라는 더 강한 가정을 두면

$$
\begin{aligned}
J(\pi_\theta)-J(\pi^*)
&\le\epsilon\sum_{t=1}^{T}(T-t+1)\\
&=\epsilon\frac{T(T+1)}2\\
&=O(\epsilon T^2)
\end{aligned}
$$

로 표현할 수도 있다. 두 상한은 가정이 다르지만 같은 $O(\epsilon T^2)$ 차수를 갖는다.

한편 $\Pr(F_t)=(1-\epsilon)^{t-1}\epsilon$으로 쓰려면, 이전까지 실수가 없다는 조건 아래 매 시점의 오류 확률이 $\epsilon$으로 일정해야 한다. 위 유도에서는 이 가정 없이 $\Pr(F_t)\le e_t$만 사용했다.

### 3.3 Horizon에 따른 오차 증가

$\epsilon$이 작더라도 $T$가 길면 상한은 크게 증가한다. 예를 들어 드론이 10 Hz의 의사결정 주기로 40초 동안 행동한다면 $T=400$이다. 다만 이 결과는 worst-case bound이며, 실제 오차가 항상 $T^2$에 비례한다는 뜻은 아니다.

전문가 분포에서의 예측 오차를 줄여도, 데이터에 없는 recovery state에서는 적절한 행동을 알기 어렵다.

### 3.4 Mistakes and recovery

아래는 강의에서 stability를 설명할 때 사용하는 그림이다. 궤적이 조금 벗어나더라도 적절한 행동으로 돌아올 수 있다면 오차가 계속 커지는 것을 막을 수 있다. 하지만 전문가가 경로를 잘 따라가는 시연만으로는, 경로 밖에서 돌아오는 행동까지 학습하기 어렵다.

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-12 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/levine-mistakes-and-recoveries.png" class="img-fluid rounded" width="2500" height="1220" alt="비용 지형 위에서 전문가 궤적과 주변 궤적을 비교한 stability 개념도." caption="stability (more on this later)<br>출처: <a href='https://rail.eecs.berkeley.edu/deeprlcourse-fa23/static/slides/lec-2.pdf#page=10'>Sergey Levine, CS 285 — Supervised Learning of Behaviors (Fall 2023)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

이를 위해서는 학습 정책의 실수로 도달한 상태와 그 상태에서의 올바른 복구 행동이 데이터에 포함되어야 한다. DAgger는 정책을 직접 실행하며 이런 상태를 수집한다. 시행착오를 거치지만, 행동을 학습하는 신호는 여전히 전문가의 라벨이다.

---

## 4. 기존 해결 시도: Forward Training과 SMILe

### 4.1 Forward Training: 시점별로 다른 정책 학습

Forward Training은 $T$개의 시간 단계에 대해 서로 다른 정책 $\pi_1,\ldots,\pi_T$를 순차적으로 학습한다.

$$
a_t=\pi_t(s_t).
$$

$\pi_t$를 학습할 때에는 이미 학습된 $\pi_1,\ldots,\pi_{t-1}$을 실행하여 **시간 $t$에 실제로 도착하는 상태**에서 전문가 행동을 수집한다. 따라서 $\pi_t$는 자신이 실제로 마주할 상태분포에서 학습된다.

하지만 작업 길이가 $T$라면 시간 단계별 정책을 $T$개 학습해야 한다. 작업 길이가 크거나 정해지지 않은 문제에 적용하기 어려우며, 최종 정책은 시점에 따라 달라지는 **non-stationary policy(시간의존 정책)**가 된다.

### 4.2 SMILe: 학습 정책들을 확률적으로 혼합

SMILe(Stochastic Mixing Iterative Learning)은 시간 단계별 정책 대신 모든 시점에서 사용하는 확률적 혼합 정책을 구성한다. 처음에는 전문가 정책 $\pi_0=\pi^*$에서 시작하고, 반복마다 새로운 학습 정책 $\hat\pi_n$을 혼합에 추가한다.

$$
\pi_n
=\pi_{n-1}+\alpha(1-\alpha)^{n-1}(\hat\pi_n-\pi_0).
$$

예를 들어 $\alpha=0.2$이면

$$
\pi_1=0.8\pi^*+0.2\hat\pi_1,
$$

$$
\pi_2=0.64\pi^*+0.2\hat\pi_1+0.16\hat\pi_2.
$$

여기서 정책을 더한다는 것은 행동값을 직접 평균한다는 의미가 아니라, **실행할 정책을 확률적으로 선택한다**는 의미이다. 학습이 진행되면서 전문가가 행동을 실행하는 비중을 줄이고, 최종적으로 전문가를 제외한 정책 혼합을 사용한다.

단일 정책으로 즉시 교체하는 것보다 상태분포의 급격한 변화를 완화할 수 있지만, 학습 정책 여러 개를 유지하며 확률적으로 실행해야 한다는 복잡성이 있다.

| 방법 | 학습 데이터가 수집되는 상태 | 최종 실행 방식 |
| :-- | :-- | :-- |
| BC | 전문가가 방문한 상태 | 하나의 학습 정책 |
| Forward Training | 앞선 시점의 학습 정책들이 도달한 상태 | 시점별로 다른 정책 |
| SMILe | 이전 혼합 정책이 방문한 상태 | 학습 정책들의 확률적 혼합 |
| DAgger | 현재 수집 정책이 방문한 상태를 반복해서 누적 | 검증으로 선택한 하나의 학습 정책 |

이전 정책 $\pi_{n-1}$이 방문한 상태로만 $\pi_n$을 학습하면, 새 정책의 상태분포 $d_{\pi_n}$에서 다시 오차가 커질 수 있다. DAgger는 현재 데이터뿐 아니라 이전 반복에서 수집한 데이터도 함께 사용한다.

---

## 5. DAgger: Dataset Aggregation

DAgger는 학습 정책이 방문한 상태에서 전문가 행동을 수집하고, 이 데이터를 **이전에 수집한 모든 데이터와 합쳐** 정책을 다시 학습한다.

### 5.1 Algorithm 3.1

```pseudocode
\begin{algorithm}
\caption{DAgger}
\begin{algorithmic}
\REQUIRE Expert $\pi^*$, policy class $\Pi$, horizon $T$
\REQUIRE Iterations $N$, mixing schedule $\beta_{1:N}$
\STATE $\mathcal{D} \gets \emptyset$, $\hat{\pi}_1 \in \Pi$
\FOR{$i = 1, \ldots, N$}
    \STATE $\pi_i \gets \beta_i\pi^* + (1-\beta_i)\hat{\pi}_i$
    \STATE Collect $T$-step trajectories using $\pi_i$
    \STATE $S_i \gets$ states visited in these trajectories
    \STATE $\mathcal{D}_i \gets \{(s,\pi^*(s)):s\in S_i\}$
    \STATE $\mathcal{D} \gets \mathcal{D} \cup \mathcal{D}_i$
    \STATE $\hat{\pi}_{i+1} \gets \mathrm{SupervisedLearn}(\mathcal{D})$
\ENDFOR
\RETURN Best $\hat{\pi}_i$ on validation
\end{algorithmic}
\end{algorithm}
```

Ross et al. (2011)의 [Algorithm 3.1](https://proceedings.mlr.press/v15/ross11a/ross11a.pdf#page=4)을 본문의 표기에 맞춰 정리했다. $S_i$에는 같은 상태의 반복 관측도 포함한다. $\mathcal D$의 합집합 표기는 중복 제거가 아니라 학습 샘플의 누적을 나타낸다.

수집 정책 $\pi_i$와 학습 정책 $\hat\pi_i$는 구분해야 한다.

$$
\boxed{\pi_i=\beta_i\pi^*+(1-\beta_i)\hat\pi_i}
$$

$\beta_i$는 데이터를 수집할 때 전문가 행동을 **실제로 실행하는 확률**이다. 반면 전문가의 **행동 라벨**은 학습 정책이 방문한 상태에서도 계속 요청한다. 따라서 실행된 행동과 데이터셋에 저장되는 전문가 행동은 같지 않을 수 있다.

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-12 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/levine-dagger-loop.png" class="img-fluid rounded" width="2860" height="450" alt="전문가 데이터로 학습한 정책을 실행하고, 방문 관측에 전문가 라벨을 붙인 뒤 누적 데이터로 다시 학습하는 DAgger 반복." caption="DAgger: Dataset Aggregation<br>출처: <a href='https://rail.eecs.berkeley.edu/deeprlcourse-fa23/static/slides/lec-2.pdf#page=12'>Sergey Levine, CS 285 — Supervised Learning of Behaviors (Fall 2023)</a>; Ross et al. (2011)." zoomable=true avoid_scaling=true %}
  </div>
</div>

### 5.2 Expert mixing

원 논문은 일반적인 혼합 확률 $\beta_i$를 허용하지만, 가장 간단한 형태는

$$
\beta_i=\mathbf1\{i=1\}
=\begin{cases}1,&i=1,\\0,&i\ge2\end{cases}
$$

이다. 즉, 처음에는 전문가가 시연하고 이후에는 학습 정책이 직접 행동한다. 학습 초기의 위험한 상태 방문이나 특정 상태에서 반복적으로 막히는 문제를 완화하고 싶다면 $\beta_i=p^{i-1}$처럼 전문가 비중을 점차 줄일 수도 있다.

일반적인 no-regret 분석에서는 평균 혼합 비율이 0으로 수렴하는 조건을 사용한다.

$$
\bar\beta_N=\frac1N\sum_{i=1}^N\beta_i\longrightarrow0.
$$

다만 아래의 구체적인 성능 정리는 혼합 비율의 감소 속도와 학습 손실 등에 관한 추가 가정을 사용한다.

---

## 6. No-Regret Online Learning

논문은 DAgger의 데이터 수집과 정책 업데이트를 **online learning**으로 분석한다.

반복마다 새로운 손실이 주어지고, 지금까지 관측한 손실을 이용해 다음 정책을 선택하는 문제이다. 실시간으로 매 프레임 신경망을 업데이트한다는 의미와는 다르다.

### 6.1 Follow-The-Leader

반복 $i$에서 사용하는 수집 정책 $\pi_i$의 상태분포를 기준으로, 고정된 후보 정책 $\pi$를 평가하는 손실을

$$
L_i(\pi)=\mathbb E_{s\sim d_{\pi_i}}[\ell(s,\pi)]
$$

라고 정의한다. 그러면 누적 데이터에서 정책을 다시 학습하는 절차는 이상적으로

$$
\boxed{\;
\hat\pi_{i+1}=\arg\min_{\pi\in\Pi}\sum_{j=1}^{i}L_j(\pi)
\;}
$$

와 같다. 이는 지금까지 관측한 손실의 합을 최소화하는 정책을 다음 반복에서 선택하는 **Follow-The-Leader(FTL)**이다.

### 6.2 No-regret의 의미

이전에 선택했던 정책들의 평균 손실과, 모든 반복을 사후적으로 알고 선택한 최적의 **단일 고정 정책**의 평균 손실을 비교한다.

$$
\begin{aligned}
\gamma_N
&=\frac1N\sum_{i=1}^{N}L_i(\hat\pi_i)
-\min_{\pi\in\Pi}\frac1N\sum_{i=1}^{N}L_i(\pi),\\
\epsilon_N
&=\min_{\pi\in\Pi}\frac1N\sum_{i=1}^{N}L_i(\pi).
\end{aligned}
$$

$\gamma_N$은 평균 후회(average regret), $\epsilon_N$은 사후 최적 정책의 평균 손실이다. 매 반복 다른 정책을 선택하므로 평균 후회는 음수일 수도 있다. 온라인 학습 알고리즘이 **no-regret**이라는 것은

$$
\limsup_{N\to\infty}\gamma_N\le0
$$

을 의미한다. 손실이 강한 볼록성(strong convexity) 등 적절한 조건을 만족하면 FTL의 후회를 충분히 빠르게 감소시키는 결과를 활용할 수 있다.

위 결과의 손실은 수집 정책의 상태분포 $d_{\pi_i}$에서 평가된다. 실제 실행에서는 전문가를 제외하므로, 학습 정책만 실행한 분포 $d_{\hat\pi_i}$와의 차이를 추가로 제한해야 한다.

---

## 7. Expert mixing에 따른 분포 차이

**Lemma 4.1 (Ross et al., 2011).** $\pi_i=\beta_i\pi^*+(1-\beta_i)\hat\pi_i$일 때,

$$
\boxed{\;\|d_{\pi_i}-d_{\hat\pi_i}\|_1\le2T\beta_i\;}
$$

이다.

**Proof.** 길이가 $T$인 궤적에서 전문가 행동이 한 번도 선택되지 않을 확률은 $(1-\beta_i)^T$이다. 이 경우 혼합 정책의 궤적은 학습 정책 $\hat\pi_i$만 실행한 궤적과 같다.

전문가 행동이 적어도 한 번 선택되었다는 조건에서의 평균 상태분포를 $d'$라고 하면

$$
d_{\pi_i}=(1-\beta_i)^Td_{\hat\pi_i}+
\bigl[1-(1-\beta_i)^T\bigr]d'
$$

가 된다. 따라서

$$
\begin{aligned}
\|d_{\pi_i}-d_{\hat\pi_i}\|_1
&=\bigl[1-(1-\beta_i)^T\bigr]
\|d'-d_{\hat\pi_i}\|_1\\
&\le 2\bigl[1-(1-\beta_i)^T\bigr]\\
&\le2T\beta_i.
\end{aligned}
$$

여기서 임의의 두 확률분포 사이의 $L^1$ 거리가 2 이하라는 사실과 $(1-\beta)^T\ge1-T\beta$를 사용했다. $\beta_i\to0$이면 혼합 수집 정책과 순수 학습 정책 사이의 분포 차이에 관한 상한도 줄어든다.

특히 $\beta_i=0$이면 두 상태분포는 동일하다. Expert mixing 없이도 학습 정책을 실행해 데이터를 수집할 수 있다.

---

## 8. DAgger의 성능 보장: Theorem 3.1

No-regret 성질과 Lemma 4.1을 결합한다. 손실은 $0\le\ell(s,\pi)\le\ell_{\max}$로 제한되며, 평균 후회는 $\gamma_N$으로 둔다.

우선 학습된 정책들 중 손실이 가장 작은 정책의 손실은 전체 평균 이하이다.

$$
\min_{1\le i\le N}
\mathbb E_{d_{\hat\pi_i}}[\ell(s,\hat\pi_i)]
\le\frac1N\sum_{i=1}^N
\mathbb E_{d_{\hat\pi_i}}[\ell(s,\hat\pi_i)].
$$

Lemma 4.1을 이용해 각 항을 수집 정책의 상태분포에 대한 기대값으로 바꾸면

$$
\begin{aligned}
\frac1N\sum_{i=1}^N
\mathbb E_{d_{\hat\pi_i}}[\ell(s,\hat\pi_i)]
\le{}&\frac1N\sum_{i=1}^N
\mathbb E_{d_{\pi_i}}[\ell(s,\hat\pi_i)]\\
&+\frac{2\ell_{\max}}N
\sum_{i=1}^N\min\{1,T\beta_i\}.
\end{aligned}
$$

그런데 No-Regret의 정의에 의해

$$
\frac1N\sum_{i=1}^N
\mathbb E_{d_{\pi_i}}[\ell(s,\hat\pi_i)]
\le\epsilon_N+\gamma_N
$$

이다. 두 식을 결합하면

$$
\boxed{
\begin{aligned}
\min_i\mathbb E_{d_{\hat\pi_i}}[\ell(s,\hat\pi_i)]
\le{}&\underbrace{\epsilon_N}_{\text{사후 최적 손실}}
+\underbrace{\gamma_N}_{\text{온라인 학습 후회}}\\
&+\underbrace{\frac{2\ell_{\max}}N
\sum_{i=1}^N\min\{1,T\beta_i\}}_{\text{전문가 혼합에 따른 분포 차이}}.
\end{aligned}}
$$

를 얻는다. 원 논문의 Theorem 4.1은 $\beta_i$가 감소한다는 조건 아래 마지막 합을 두 구간으로 나누어 표현한다.

### 8.1 Theorem 3.1의 의미

$\ell$이 유계이고 정책 집합 위에서 강한 볼록성을 만족한다고 하자. 원문의 구체적인 혼합 조건은 $T$와 무관한 상수 $\alpha\in(0,1)$에 대해 $\beta_i\le(1-\alpha)^{i-1}$이다. $N=\tilde O(T)$ 규모의 충분한 반복을 수행하면 학습된 정책들 중 다음을 만족하는 정책 $\hat\pi$가 존재한다.

$$
\boxed{\;
\mathbb E_{s\sim d_{\hat\pi}}[\ell(s,\hat\pi)]
\le\epsilon_N+O(1/T)
\;}
\qquad\text{(Theorem 3.1)}
$$

학습 정책 자신의 상태분포에서 평가한 손실이, 수집된 상태분포에 대한 사후 최적 손실 $\epsilon_N$에 가까워진다.

이 보장은 마지막 정책이 아니라 학습된 정책 중 적어도 하나에 대해 성립한다. Algorithm 3.1에서 검증 성능이 가장 좋은 정책을 반환하는 이유이다.

특히 첫 번째 반복에서만 전문가를 실행하는 $\beta_i=\mathbf1\{i=1\}$의 경우, 전문가 혼합 오차항은 단순히 $2\ell_{\max}/N$으로 감소한다. 나머지는 No-Regret 학습기에 의해 제어된다.

---

## 9. 누적 비용 상한: uTε

Theorem 3.1은 대리 손실에 대한 결과이다. 이를 실제 작업 비용 $J(\pi)$와 연결하기 위해 Theorem 2.2를 사용한다.

### 9.1 한 번의 행동 불일치에 따른 비용

$Q_h^{\pi^*}(s,a)$를 상태 $s$에서 행동 $a$를 한 번 실행하고, 이후에는 전문가 정책을 따라 남은 $h$단계 동안 발생하는 기대 누적 비용이라고 하자.

어떤 상태에서 전문가가 선택할 행동 대신 다른 행동을 한 번 선택했을 때의 비용 차이가 다음처럼 제한된다고 가정한다.

$$
\boxed{\;
Q_{T-t+1}^{\pi^*}(s,a)
-Q_{T-t+1}^{\pi^*}(s,\pi^*)\le u
\;}
$$

이 부등식은 모든 관련 상태, 행동, 시점에 대해 성립한다고 둔다. $u$는 한 번의 행동 불일치로 발생하는 추가 누적 비용의 상한이다.

전문가가 실수를 빠르게 복구할 수 있다면 $u$가 작을 수 있다. 반면 드론이 한 번의 실수로 충돌하거나 회복이 어려운 상태에 진입한다면 $u$는 커질 수 있다. 최악의 경우 $u=O(T)$도 가능하다.

### 9.2 Hybrid Policy와 Telescoping Sum

학습 정책 $\pi$를 처음 $t$단계 실행한 다음 나머지는 전문가를 따르는 가상 정책을 $\pi_{1:t}$라고 하자. 이때

$$
\pi_{1:0}=\pi^*,\qquad \pi_{1:T}=\pi.
$$

전체 비용 차이를 시점별로 한 번의 행동을 교체했을 때의 비용 차이로 분해하면

$$
\begin{aligned}
J(\pi)-J(\pi^*)
&=\sum_{t=1}^{T}
\bigl[J(\pi_{1:t})-J(\pi_{1:t-1})\bigr]\\
&=\sum_{t=1}^{T}
\mathbb E_{s\sim d_\pi^t}
\left[Q_{T-t+1}^{\pi^*}(s,\pi)
-Q_{T-t+1}^{\pi^*}(s,\pi^*)\right].
\end{aligned}
$$

이다. 중간 항이 소거되는 **telescoping sum(망원합)**을 사용했다. 시간 $t$ 이전에는 두 정책이 같은 학습 정책을 실행하므로, 각 차이는 $d_\pi^t$에서 평가된다.

$\ell(s,\pi)$이 전문가 행동과의 0-1 불일치 손실의 상한이라고 하면, 서로 다른 행동을 선택할 확률에 $u$를 곱해 다음을 얻는다.

$$
\begin{aligned}
J(\pi)-J(\pi^*)
&\le u\sum_{t=1}^{T}
\mathbb E_{s\sim d_\pi^t}[\ell(s,\pi)]\\
&=uT\,\mathbb E_{s\sim d_\pi}[\ell(s,\pi)]\\
&=uT\epsilon_{\mathrm{self}}.
\end{aligned}
$$

여기서

$$
\epsilon_{\mathrm{self}}=
\mathbb E_{s\sim d_\pi}[\ell(s,\pi)]
$$

은 **학습 정책 자신의 상태분포에서 측정한 모방 오차**이다.

### 9.3 Theorem 3.2: DAgger의 실제 비용 보장

Theorem 3.1이 $\epsilon_{\mathrm{self}}\le\epsilon_N+O(1/T)$ 형태의 보장을 제공하고, 위의 비용 차이 분석을 함께 적용하면 충분한 반복 횟수 $N=\tilde O(uT)$에서 다음 결과를 얻는다.

$$
\boxed{\;
J(\hat\pi)
\le J(\pi^*)+uT\epsilon_N+O(1)
\;}
\qquad\text{(Theorem 3.2)}
$$

여기서 반복 횟수를 $uT$ 수준에 맞추는 것은 $uT$를 곱해도 남는 오차항이 $O(1)$이 되도록 하기 위함이다.

BC와 DAgger의 상한을 비교하면 다음과 같다.

| 방법 | 오차를 평가하는 상태분포 | 추가 누적 비용 상한 |
| :-- | :-- | :-- |
| BC | 전문가의 $d_{\pi^*}$ | $T^2\epsilon_{\mathrm{BC}}$ |
| DAgger | 학습 정책 자신의 $d_{\hat\pi}$ | $uT\epsilon_N+O(1)$ |

$u=O(1)$이면 DAgger는 $T$에 대해 선형적인 추가 비용 보장을 얻지만, $u=O(T)$라면 일반적인 경우 이차적 비용이 다시 나타날 수 있다. 따라서 **DAgger가 $u$를 줄이는 알고리즘인 것은 아니다.** DAgger는 자신의 상태분포에서의 모방 오차를 제어하는 학습 방법이고, $u$는 시스템 동역학과 전문가의 복구 특성 등에 관한 문제 의존적인 상한이다.

또한 연속 행동에 사용하는 일반적인 MSE가 0-1 행동 불일치의 상한이 되는 것은 아니다. 따라서 실제 연속 제어 작업에 같은 비용 보장을 적용하려면 손실과 작업 비용을 연결하는 별도의 가정이나 분석이 필요하다.

---

## 10. Finite-sample 결과

앞의 분석은 각 반복에서 진짜 상태분포의 기대 손실을 정확히 알고 있다고 가정한다. 실제로는 각 반복에서 유한한 개수의 궤적만 관측한다.

원 논문은 Azuma–Hoeffding 부등식으로 $mN$개 궤적의 표본 오차를 제한한다. Theorem 4.2에는 다음 항이 추가된다.

$$
\ell_{\max}\sqrt{\frac{2\log(1/\delta)}{mN}}.
$$

여기서 $m$은 반복마다 수집한 궤적 수이고 $1-\delta$는 보장 확률이다. 유한 표본에서는 비교 대상도 기대 손실 $\epsilon_N$이 아니라 수집한 데이터에서의 사후 최적 경험 손실 $\hat\epsilon_N$으로 바뀐다. Theorem 3.3과 3.4는 이를 이용해 반복 횟수에 따른 보장을 제시한다.

---

## 11. DAgger의 한계와 이후 문제

실제 로봇에 DAgger를 적용할 때는 다음 문제들이 남는다.

**1. 지속적인 전문가 라벨 요구.** 정책이 방문한 상태에 대해 전문가가 적절한 행동을 제공할 수 있어야 한다. 따라서 긴 궤적과 많은 반복이 필요한 문제에서는 전문가 질의 비용이 커진다.

**2. 학습 중 안전 보장의 부재.** DAgger는 미숙한 학습 정책을 실제로 실행하여 데이터를 수집한다. 전문가를 일부 혼합해 실행할 수 있지만, 이것이 충돌 회피나 안전을 보장하지는 않는다.

**3. 전문가 행동의 불완전성.** 인간의 행동에는 조종 실수, 반응 지연, 개인 간 차이 등이 존재한다. DAgger는 수집한 전문가 행동을 모방 대상으로 사용하지만, 행동 신호의 신뢰도나 의도를 별도로 추론하지 않는다.

**4. 부분 관측 및 정보 불일치.** 전문가는 전체 상태를 알고 있지만 학습 정책은 카메라 영상만 사용하는 상황이라면, 동일한 관측에 서로 다른 전문가 행동이 대응할 수 있다. 데이터 누적만으로 관측에서 식별할 수 없는 정보를 복원할 수는 없다.

**5. 이론적 가정과 실제 딥러닝의 차이.** 핵심 정리는 no-regret 학습기 및 강한 볼록성 등의 조건을 사용한다. 일반적인 심층 신경망 정책을 비볼록 손실로 학습할 때 이론적 보장이 그대로 성립하는 것은 아니다.

**Learning from interventions**에서는 전문가가 위험하거나 수정이 필요하다고 판단한 순간에만 개입하는 경우가 많다. 이때는 개입하지 않은 상태의 처리, 개입 시점, 개입 행동의 신뢰도까지 고려해야 한다.

---

## 12. Experiments

Ross et al. (2011)의 Section 5에서는 Super Tux Kart, Super Mario Bros., handwriting recognition으로 DAgger를 평가한다. 아래 그림과 수치는 논문에서 보고한 결과이다.

### 12.1 Super Tux Kart

고정 속도의 카트를 영상 특징으로 조향하며 인간이 정답을 제공한다. 반복마다 한 바퀴를 수집하고, 20회 학습한다.

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-7 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/ross2011-fig1-kart-environment.png" class="img-fluid rounded" width="606" height="453" alt="우주 위의 좁은 트랙을 달리는 Super Tux Kart 실험 화면." caption="Image from Super Tux Kart’s Star Track.<br>출처: <a href='https://proceedings.mlr.press/v15/ross11a/ross11a.pdf#page=6'>Ross, Gordon &amp; Bagnell (2011)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-10 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/ross2011-fig2-kart-results.png" class="img-fluid rounded" width="870" height="780" alt="학습 데이터가 늘어날 때 DAgger의 평균 트랙 이탈은 0에 가까워지지만 SMILe과 Supervised에는 이탈이 남는 그래프." caption="Average falls/lap as a function of training data.<br>출처: <a href='https://proceedings.mlr.press/v15/ross11a/ross11a.pdf#page=6'>Ross, Gordon &amp; Bagnell (2011)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

가로축은 누적 학습 데이터 수, 세로축은 **한 바퀴당 평균 트랙 이탈 횟수**이다. 오차 막대는 95% 신뢰구간이다. Supervised는 전문가 데이터만 사용하는 BC에 해당한다. 이 실험에서는 전문가 데이터가 늘어도 이탈이 줄지 않은 반면, DAgger는 15회 이후 평가에서 이탈이 관찰되지 않았다.

### 12.2 Super Mario Bros.

전문가는 내부 상태를 사용하는 planner이며, 학습기는 영상 특징으로 버튼 입력을 예측한다. 난이도 1의 무작위 스테이지에서 60초 제한으로 평가한다.

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-7 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/ross2011-fig3-mario-environment.png" class="img-fluid rounded" width="606" height="453" alt="블록 위의 Mario와 주변 장애물이 보이는 Super Mario Bros. 실험 화면." caption="Captured image from Super Mario Bros.<br>출처: <a href='https://proceedings.mlr.press/v15/ross11a/ross11a.pdf#page=7'>Ross, Gordon &amp; Bagnell (2011)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-10 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/ross2011-fig4-mario-results.png" class="img-fluid rounded" width="870" height="756" alt="DAgger와 SEARN, SMILe, 지도학습의 학습 데이터 수에 따른 스테이지당 평균 이동 거리를 비교한 그래프." caption="Average distance/stage as a function of data.<br>출처: <a href='https://proceedings.mlr.press/v15/ross11a/ross11a.pdf#page=7'>Ross, Gordon &amp; Bagnell (2011)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

세로축은 **스테이지당 평균 이동 거리**이므로 높을수록 좋다. 오차 막대는 95% 신뢰구간이다. D0는 첫 반복만 전문가를 실행하며, D0.5·D0.9는 각각 $\beta_i=0.5^{i-1}$·$0.9^{i-1}$이다. Se는 SEARN, Sm은 SMILe, Sup는 지도학습이다.

BC는 전문가 시연에 드문, 장애물 바로 앞에 갇힌 상태에서 복구하기 어렵다. DAgger는 이런 상태의 전문가 행동도 학습한다. D0.5와 D0의 최종 평균 거리는 각각 3030과 2980으로 비슷하다. 전문가를 더 오래 섞는 D0.9는 개선이 느리다.

### 12.3 Handwriting Recognition

이전 문자의 예측을 다음 문자 입력에 사용하는 순차 인식이다. 10-fold 평가에서 **문자 단위 정확도**를 측정한다.

<div class="row mt-3 justify-content-sm-center">
  <div class="col-sm-10 mt-3 mt-md-0">
    {% include figure.liquid loading="lazy" path="assets/img/blog_img/imitation-learning-basics/ross2011-fig5-handwriting-results.png" class="img-fluid rounded" width="870" height="825" alt="학습 반복에 따른 테스트 문자 정확도 비교. DAgger와 SEARN 일부 설정은 비슷한 정확도를 보이고 지도학습 기준선보다 높다." caption="Character accuracy as a function of iteration.<br>출처: <a href='https://proceedings.mlr.press/v15/ross11a/ross11a.pdf#page=8'>Ross, Gordon &amp; Bagnell (2011)</a>." zoomable=true avoid_scaling=true %}
  </div>
</div>

가로축은 반복 횟수, 세로축은 정확도이다. 논문에서 보고한 정확도는 Supervised 83.6%, DAgger 85.5%이며, SEARN의 일부 설정도 DAgger와 비슷한 성능을 보인다. 잘못 예측한 문자가 다음 입력에 포함되는 상황을 학습한다는 점에서 제어 문제의 distribution shift와 같은 구조를 갖는다.

---

## Conclusion

BC는 전문가가 방문한 상태에서 학습한다. DAgger는 학습 정책이 실제로 방문한 상태에서 전문가 라벨을 받고, 이전 데이터와 함께 다시 학습한다. 정책 모델보다 학습 데이터의 분포를 바꾼다는 점이 두 방법의 차이이다.

No-regret 조건과 앞서 정리한 손실·mixing 가정 아래에서는 학습 정책 자신의 상태분포에서 작은 모방 손실을 갖는 정책이 존재한다. 누적 비용 보장은 복구 비용 상한 $u$에 의존하므로, 모든 문제에서 BC의 $O(T^2\epsilon)$을 선형 상한으로 바꾸는 것은 아니다.

또한 정책을 실행하며 전문가 라벨을 계속 받아야 하고, 학습 중 안전은 별도로 다뤄야 한다. 이후 HG-DAgger 등 인간 개입 기반 방법을 볼 때도 데이터 수집 정책과 전문가 피드백이 어떻게 달라지는지 비교할 수 있다.

---

## References

- [Sergey Levine, **CS 285: Supervised Learning of Behaviors**, UC Berkeley, Fall 2023, Lecture 2](https://rail.eecs.berkeley.edu/deeprlcourse-fa23/static/slides/lec-2.pdf). Stability p.10, distribution shift p.11, DAgger p.12, 오차 누적 분석 pp.35–37.
- [Stéphane Ross and J. Andrew Bagnell, **Efficient Reductions for Imitation Learning**, AISTATS 2010](https://proceedings.mlr.press/v9/ross10a.html). Forward Training과 SMILe 및 기존 BC의 오차 누적 분석.
- [Stéphane Ross, Geoffrey J. Gordon, and J. Andrew Bagnell, **A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning**, AISTATS 2011](https://proceedings.mlr.press/v15/ross11a.html). Algorithm 3.1, Theorem 2.1–3.4, Lemma 4.1, Theorem 4.1–4.2, Section 5.
