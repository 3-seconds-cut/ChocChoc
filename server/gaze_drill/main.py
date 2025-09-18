from drill_generator import gaze_drill_generator

for remaining_direction in gaze_drill_generator(
        k=5, src="0", mirror=True, tau_x=0.7, tau_y=0.55, hold_sec=3.0, jitter_sec=0.15):
    print("남은(현재 목표) 방향:", remaining_direction)

print("모든 방향 성공! 종료됩니다.")