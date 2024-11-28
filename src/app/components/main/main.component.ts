import {
	Component,
	OnInit,
	OnDestroy,
	ViewChild,
	ElementRef,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";

interface Loop {
	id: number;
	startHours: number;
	startMinutes: number;
	startSeconds: number;
	endHours: number;
	endMinutes: number;
	endSeconds: number;
	isValid: boolean;
}

interface SavedData {
	videoUrl: string;
	loops: Loop[];
}

@Component({
	selector: "app-main",
	standalone: true,
	imports: [FormsModule, CommonModule],
	templateUrl: "./main.component.html",
})
export class YoutubeClipper implements OnInit, OnDestroy {
	videoUrl: string = "";
	videoId: string = "";
	isVideoLoaded: boolean = false;
	player!: YT.Player;
	timeUpdateInterval: any;

	// Jump Time Inputs
	jumpStartHours: number = 0;
	jumpStartMinutes: number = 0;
	jumpStartSeconds: number = 0;

	// Loops
	loops: Loop[] = [];
	loopIdCounter: number = 1;

	// Volume Controls
	volume: number = 100;
	isMuted: boolean = false;
	previousVolume: number = 100;

	// Current Loop Index
	currentLoopIndex: number = 0;

	// Video Duration in seconds
	videoDuration: number = 0;

	// Maximum values for jump inputs
	maxJumpStartHours: number = 0;
	maxJumpStartMinutes: number = 59;
	maxJumpStartSeconds: number = 59;

	// Maximum values for loop inputs
	maxLoopStartHours: number = 0;
	maxLoopStartMinutes: number = 59;
	maxLoopStartSeconds: number = 59;

	maxLoopEndHours: number = 0;
	maxLoopEndMinutes: number = 59;
	maxLoopEndSeconds: number = 59;

	// Control visibility of time inputs
	showHours: boolean = false;
	showMinutes: boolean = true;
	showSeconds: boolean = true;

	// Validation
	isJumpTimeValid: boolean = true;
	isLoopTimeValid: boolean = true;

	// Loading State
	isLoading: boolean = false;

	// Looping State
	isLooping: boolean = false;

	// Current Time
	currentTime: number = 0;

	@ViewChild('player') playerRef!: ElementRef;
	loopStartHours: number = 0;
	loopEndHours: number = 0;
	loopStartMinutes: number = 0;
	loopEndMinutes: number = 0;

	ngOnInit() {
		// Initialize with one loop
		this.addLoop();
		// Load the YouTube IFrame API script if not already loaded
		if (!(window as any)['YT']) {
			const tag = document.createElement('script');
			tag.src = "https://www.youtube.com/iframe_api";
			const firstScriptTag = document.getElementsByTagName('script')[0];
			firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
		}

		// Define the callback for when the API is ready
		(window as any)['onYouTubeIframeAPIReady'] = () => {
			// API is ready
			// Player will be initialized when loadVideo is called
		};
	}

	ngOnDestroy() {
		if (this.timeUpdateInterval) {
			clearInterval(this.timeUpdateInterval);
		}
		if (this.player) {
			this.player.destroy();
		}
	}

	loadVideo() {
		this.videoId = this.extractVideoId(this.videoUrl)!;
		if (this.videoId) {
			this.isVideoLoaded = true;
			this.isLoading = true; // Start loading
			// Delay initialization to ensure playerRef is available
			setTimeout(() => {
				this.initializePlayer();
			}, 0);
		} else {
			alert("Please enter a valid YouTube URL.");
		}
	}

	extractVideoId(url: string): string | null {
		const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
		const match = url.match(regex);
		return match ? match[1] : null;
	}

	initializePlayer() {
		if ((window as any)['YT'] && (window as any)['YT'].Player) {
			if (this.player) {
				this.player.loadVideoById(this.videoId);
			} else {
				this.player = new (window as any)['YT'].Player(this.playerRef.nativeElement, {
					height: '390',
					width: '640',
					videoId: this.videoId,
					events: {
						'onReady': this.onPlayerReady.bind(this),
						'onStateChange': this.onPlayerStateChange.bind(this),
					},
				});
			}
		} else {
			// Retry after 1 second if YT is not ready
			setTimeout(() => this.initializePlayer(), 1000);
		}
	}

	onPlayerReady(event: YT.PlayerEvent) {
		event.target.playVideo();
		// Retrieve video duration
		this.videoDuration = Math.floor(this.player.getDuration()); // Round down to whole seconds
		this.configureTimeInputs();
		this.isLoading = false; // Loading complete
		this.startTimeUpdater();

		// Initialize volume
		this.volume = this.player.getVolume();
		this.isMuted = this.player.isMuted();
	}

	onPlayerStateChange(event: YT.OnStateChangeEvent) {
		if (event.data === YT.PlayerState.PLAYING) {
			this.startTimeUpdater();
		} else {
			this.stopTimeUpdater();
		}
	}

	startTimeUpdater() {
		if (this.timeUpdateInterval) {
			clearInterval(this.timeUpdateInterval);
		}
		this.timeUpdateInterval = setInterval(() => {
			if (this.player && this.player.getCurrentTime) {
				this.currentTime = this.player.getCurrentTime();
				this.validateCurrentTime();

				if (this.isLooping && this.isLoopTimeReached()) {
					this.handleLoopTransition();
				}
			}
		}, 500);
	}

	stopTimeUpdater() {
		if (this.timeUpdateInterval) {
			clearInterval(this.timeUpdateInterval);
		}
	}

	// Configure which time inputs to show based on video duration
	configureTimeInputs() {
		this.showHours = this.videoDuration >= 3600;
		this.showMinutes = this.videoDuration >= 60;
		this.showSeconds = true;

		if (this.showHours) {
			this.maxJumpStartHours = Math.floor(this.videoDuration / 3600);
			this.maxLoopStartHours = Math.floor(this.videoDuration / 3600);
			this.maxLoopEndHours = Math.floor(this.videoDuration / 3600);
		} else {
			this.maxJumpStartHours = 0;
			this.jumpStartHours = 0;
			this.maxLoopStartHours = 0;
			this.loopStartHours = 0;
			this.maxLoopEndHours = 0;
			this.loopEndHours = 0;
		}

		if (this.showMinutes) {
			if (this.showHours) {
				this.maxJumpStartMinutes = 59;
				this.maxLoopStartMinutes = 59;
				this.maxLoopEndMinutes = 59;
			} else {
				this.maxJumpStartMinutes = Math.floor(this.videoDuration / 60);
				this.maxLoopStartMinutes = Math.floor(this.videoDuration / 60);
				this.maxLoopEndMinutes = Math.floor(this.videoDuration / 60);
			}
		} else {
			this.maxJumpStartMinutes = 0;
			this.jumpStartMinutes = 0;
			this.maxLoopStartMinutes = 0;
			this.loopStartMinutes = 0;
			this.maxLoopEndMinutes = 0;
			this.loopEndMinutes = 0;
		}

		this.maxJumpStartSeconds = 59;
		this.maxLoopStartSeconds = 59;
		this.maxLoopEndSeconds = 59;

		// Validate all loops initially
		this.validateAllLoops();
	}

	// Add a new loop
	addLoop() {
		const newLoop: Loop = {
			id: this.loopIdCounter++,
			startHours: 0,
			startMinutes: 0,
			startSeconds: 0,
			endHours: 0,
			endMinutes: 0,
			endSeconds: 0,
			isValid: true
		};
		this.loops.push(newLoop);
	}

	// Remove a loop by id
	removeLoop(id: number) {
		this.loops = this.loops.filter(loop => loop.id !== id);
		// Adjust currentLoopIndex if necessary
		if (this.currentLoopIndex >= this.loops.length) {
			this.currentLoopIndex = 0;
		}
		this.validateAllLoops();
	}

	// Calculate total jump time in seconds
	get totalJumpTime(): number {
		return (this.jumpStartHours * 3600) + (this.jumpStartMinutes * 60) + this.jumpStartSeconds;
	}

	// Calculate total loop start time in seconds
	get totalLoopStartTime(): number {
		if (this.loops.length === 0) return 0;
		const loop = this.loops[this.currentLoopIndex];
		return (loop.startHours * 3600) + (loop.startMinutes * 60) + loop.startSeconds;
	}

	// Calculate total loop end time in seconds
	get totalLoopEndTime(): number {
		if (this.loops.length === 0) return 0;
		const loop = this.loops[this.currentLoopIndex];
		return (loop.endHours * 3600) + (loop.endMinutes * 60) + loop.endSeconds;
	}

	// Validate jump time
	validateJumpTime() {
		this.isJumpTimeValid = this.totalJumpTime <= this.videoDuration;
	}

	// Validate all loops
	validateAllLoops() {
		this.isLoopTimeValid = true;
		for (let loop of this.loops) {
			const startTime = (loop.startHours * 3600) + (loop.startMinutes * 60) + loop.startSeconds;
			const endTime = (loop.endHours * 3600) + (loop.endMinutes * 60) + loop.endSeconds;
			loop.isValid = startTime < endTime && endTime <= this.videoDuration;
			if (!loop.isValid) {
				this.isLoopTimeValid = false;
			}
		}
	}

	// Handle input changes for jump time fields
	onJumpInputChange() {
		// Prevent negative numbers and non-numeric inputs
		this.jumpStartHours = this.jumpStartHours && this.jumpStartHours >= 0 ? this.jumpStartHours : 0;
		this.jumpStartMinutes = this.jumpStartMinutes && this.jumpStartMinutes >= 0 ? this.jumpStartMinutes : 0;
		this.jumpStartSeconds = this.jumpStartSeconds && this.jumpStartSeconds >= 0 ? this.jumpStartSeconds : 0;

		// Ensure minutes and seconds do not exceed 59
		if (this.jumpStartMinutes > 59) {
			this.jumpStartMinutes = 59;
		}
		if (this.jumpStartSeconds > 59) {
			this.jumpStartSeconds = 59;
		}

		// Additionally, cap hours if necessary
		if (this.showHours && this.jumpStartHours > this.maxJumpStartHours) {
			this.jumpStartHours = this.maxJumpStartHours;
		}

		// Recalculate maximum minutes based on remaining time after hours
		if (this.showHours) {
			const remainingAfterHours = this.videoDuration - (this.jumpStartHours * 3600);
			this.maxJumpStartMinutes = Math.min(59, Math.floor(remainingAfterHours / 60));
			// Adjust jumpMinutes if it exceeds new maxMinutes
			if (this.jumpStartMinutes > this.maxJumpStartMinutes) {
				this.jumpStartMinutes = this.maxJumpStartMinutes;
			}
		} else if (this.showMinutes) {
			this.maxJumpStartMinutes = Math.floor(this.videoDuration / 60);
			if (this.jumpStartMinutes > this.maxJumpStartMinutes) {
				this.jumpStartMinutes = this.maxJumpStartMinutes;
			}
		}

		// Revalidate jump time
		this.validateJumpTime();
	}

	// Handle input changes for loop time fields
	onLoopInputChange() {
		// Prevent negative numbers and non-numeric inputs
		for (let loop of this.loops) {
			loop.startHours = loop.startHours && loop.startHours >= 0 ? loop.startHours : 0;
			loop.startMinutes = loop.startMinutes && loop.startMinutes >= 0 ? loop.startMinutes : 0;
			loop.startSeconds = loop.startSeconds && loop.startSeconds >= 0 ? loop.startSeconds : 0;

			loop.endHours = loop.endHours && loop.endHours >= 0 ? loop.endHours : 0;
			loop.endMinutes = loop.endMinutes && loop.endMinutes >= 0 ? loop.endMinutes : 0;
			loop.endSeconds = loop.endSeconds && loop.endSeconds >= 0 ? loop.endSeconds : 0;

			// Ensure minutes and seconds do not exceed 59
			if (loop.startMinutes > 59) {
				loop.startMinutes = 59;
			}
			if (loop.startSeconds > 59) {
				loop.startSeconds = 59;
			}
			if (loop.endMinutes > 59) {
				loop.endMinutes = 59;
			}
			if (loop.endSeconds > 59) {
				loop.endSeconds = 59;
			}

			// Additionally, cap hours if necessary
			if (this.showHours && loop.startHours > this.maxLoopStartHours) {
				loop.startHours = this.maxLoopStartHours;
			}
			if (this.showHours && loop.endHours > this.maxLoopEndHours) {
				loop.endHours = this.maxLoopEndHours;
			}
		}

		// Revalidate all loops
		this.validateAllLoops();
	}

	// Validate current time to ensure it doesn't exceed duration
	validateCurrentTime() {
		if (this.currentTime > this.videoDuration) {
			this.currentTime = this.videoDuration;
		}
	}

	// Jump to specified time
	jumpToTime() {
		if (this.isJumpTimeValid) {
			this.player.seekTo(this.totalJumpTime, true);
		} else {
			this.clearJumpInputs();
		}
	}

	// Toggle looping on and off
	toggleLoop() {
		if (this.isLooping) {
			this.isLooping = false;
			this.currentLoopIndex = 0;
		} else {
			if (this.isAllLoopsValid) {
				this.isLooping = true;
				this.currentLoopIndex = 0;
				this.seekToCurrentLoopStart();
			} else {
				alert("Please ensure all loops are valid before starting.");
			}
		}
	}

	// Check if all loops are valid
	get isAllLoopsValid(): boolean {
		return this.loops.every(loop => loop.isValid);
	}

	// Seek to the start time of the current loop
	seekToCurrentLoopStart() {
		if (this.loops.length > 0 && this.isLooping) {
			const loop = this.loops[this.currentLoopIndex];
			const startTime = (loop.startHours * 3600) + (loop.startMinutes * 60) + loop.startSeconds;
			this.player.seekTo(startTime, true);
		}
	}

	// Handle loop transition
	handleLoopTransition() {
		if (!this.isLooping || this.loops.length === 0) return;

		// Move to next loop
		this.currentLoopIndex++;
		if (this.currentLoopIndex >= this.loops.length) {
			this.currentLoopIndex = 0; // Cycle back to first loop
		}
		this.seekToCurrentLoopStart();
	}

	// Check if loop time has been reached
	isLoopTimeReached(): boolean {
		if (this.loops.length === 0) return false;
		const loop = this.loops[this.currentLoopIndex];
		const endTime = (loop.endHours * 3600) + (loop.endMinutes * 60) + loop.endSeconds;
		return this.currentTime >= endTime;
	}

	// Handle volume change
	onVolumeChange() {
		if (this.player) {
			this.player.setVolume(this.volume);
			if (this.volume === 0) {
				this.isMuted = true;
			} else {
				this.isMuted = false;
				this.previousVolume = this.volume;
			}
		}
	}

	// Toggle mute/unmute
	toggleMute() {
		if (this.player) {
			if (this.isMuted) {
				this.player.unMute();
				this.player.setVolume(this.previousVolume > 0 ? this.previousVolume : 100);
				this.volume = this.previousVolume > 0 ? this.previousVolume : 100;
				this.isMuted = false;
			} else {
				this.previousVolume = this.volume;
				this.player.mute();
				this.volume = 0;
				this.isMuted = true;
			}
		}
	}

	// Clear jump time inputs
	clearJumpInputs(): void {
		this.jumpStartHours = 0;
		this.jumpStartMinutes = 0;
		this.jumpStartSeconds = 0;
		this.isJumpTimeValid = true;
	}

	// Format seconds into hh:mm:ss or mm:ss
	formatTime(time: number): string {
		const hours = Math.floor(time / 3600);
		const minutes = Math.floor((time % 3600) / 60);
		const seconds = Math.floor(time % 60);

		const hDisplay = hours > 0 ? `${this.padZero(hours)}:` : "";
		const mDisplay = `${this.padZero(minutes)}:`;
		const sDisplay = `${this.padZero(seconds)}`;

		return `${hDisplay}${mDisplay}${sDisplay}`;
	}

	padZero(num: number): string {
		return num < 10 ? `0${num}` : `${num}`;
	}

	get formattedCurrentTime(): string {
		return this.formatTime(this.currentTime);
	}

	get formattedDuration(): string {
		return this.formatTime(this.videoDuration);
	}
}
