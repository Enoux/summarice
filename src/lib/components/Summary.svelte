<script>
	import leftArrow from '$lib/assets/icons/left_arrow.svg';
	import test from '$lib/assets/OMI.png';
</script>

<div class="bg-sr-white flex h-screen w-screen flex-row flex-wrap px-12 py-4">
	<!-- Header -->
	<div class="flex h-1/8 w-full flex-row flex-wrap">
		<button class="flex">
			<img src={leftArrow} alt="Left Arrow" class="w-12" />
		</button>

		<div class="flex w-7/8 flex-row flex-wrap">
			<div class="mx-12 flex w-auto items-center text-4xl font-bold">
				<h1>File 2 blablabla</h1>
			</div>

			<div class="flex w-auto items-center px-2">
				<button
					class="text-md bg-sr-purple text-sr-white mx-2 w-auto rounded-2xl px-4 py-1 align-middle font-bold"
				>
					#Sample Tag 1
				</button>

				<button
					class="text-md bg-sr-purple text-sr-white mx-2 w-auto rounded-2xl px-4 py-1 align-middle font-bold"
				>
					#Sample Tag 2
				</button>
			</div>
		</div>
	</div>

	<!-- Main Topic -->
	<div class="bg-sr-light-yellow my-3 h-1/9 w-full rounded-lg px-8 py-4">
		<h2 class="text-2xl font-bold">Main Topic</h2>
		<p class="text-l italic">test topic nooooo</p>
	</div>

	<!-- Summary -->
	<div class="bg-sr-black/5 my-3 h-auto min-h-1/2 w-full rounded-lg px-8 py-4">
		<p class="my-2">
			Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis vulputate turpis.
			Quisque a urna sagittis, vehicula orci eu, iaculis augue. Praesent id velit odio. Curabitur
			cursus, orci eget consectetur elementum, risus odio lacinia ex, eu rhoncus lorem augue nec
			quam. Praesent venenatis augue est, in varius magna pharetra et. Ut placerat semper arcu vel
			fermentum. Maecenas dui sapien, vestibulum a consectetur tristique, tristique ut mauris.
			Praesent interdum odio vel lectus scelerisque, nec viverra ipsum fermentum.
		</p>
		<p class="my-2">
			Suspendisse pharetra non eros nec tincidunt. Nunc non elit at leo facilisis gravida eget sed
			turpis. Vivamus ac lectus ut lectus finibus ultrices. Suspendisse sit amet lectus vitae purus
			lacinia malesuada in vitae diam. Vestibulum vestibulum justo nisl, non sollicitudin urna
			laoreet at. Vestibulum ornare libero vel nunc vestibulum, nec elementum eros feugiat. Fusce
			laoreet leo vulputate posuere maximus. Quisque aliquet malesuada massa, sit amet laoreet neque
			dictum eu. Suspendisse vel vestibulum leo. Vestibulum in mi ac turpis iaculis molestie quis
			sit amet felis. Nam et convallis orci, non porta urna. Praesent blandit sit amet mauris
			tincidunt dignissim. Nullam vitae porta nunc.
		</p>
	</div>

	<!-- Related Pages -->
	<div class="mr-4 mb-12 flex h-1/3 w-full flex-row flex-wrap px-8 pt-4 pb-8">
		<div class="mb-4 h-1/5 w-full place-content-center text-2xl font-bold">Related Files:</div>

		<div
			class="bg-sr-light-yellow mr-10 flex h-3/4 w-1/4 flex-row flex-wrap overflow-hidden rounded-4xl"
		>
			<div class="w-1/3 place-content-center">
				<img src={test} alt="test" class="h-full w-full object-cover" />
			</div>

			<div class="group mx-6 my-4 flex w-1/2 flex-col">
				<div class="mb-2 w-full text-xl font-bold group-hover:underline">Title of Paper</div>

				<div class="mb-2 h-3/7 w-full overflow-auto text-sm">
					Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis vulputate turpis.
					Quisque a urna sagittis, vehicula orci eu, iaculis augue.
				</div>
			</div>
		</div>

		<div
			class="bg-sr-light-yellow mr-4 flex h-3/4 w-1/4 flex-row flex-wrap overflow-hidden rounded-4xl"
		>
			<div class="w-1/3 place-content-center">
				<img src={test} alt="test" class="h-full w-full object-cover" />
			</div>

			<div class="group mx-6 my-4 flex w-1/2 flex-col">
				<div class="mb-2 w-full text-xl font-bold group-hover:underline">Title of Paper</div>

				<div class="mb-2 h-3/7 w-full overflow-auto text-sm">
					Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus quis vulputate turpis.
					Quisque a urna sagittis, vehicula orci eu, iaculis augue.
				</div>
			</div>
		</div>
	</div>
</div>
