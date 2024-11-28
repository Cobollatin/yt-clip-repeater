import { Component, OnInit } from '@angular/core';
import { Footer } from "./components/footer/footer.component";
import { Header } from "./components/header/header.component";
import { Layout } from "./components/layout/layout.component";
import { YoutubeClipper } from "./components/main/main.component";

@Component({
	selector: 'app-root',
	imports: [Layout, Header, Footer, YoutubeClipper],
	templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
	ngOnInit() {
		const spinner = document.getElementById("globalSpinner");
		if (spinner) {
			spinner.style.display = "none";
		}
	}
}
