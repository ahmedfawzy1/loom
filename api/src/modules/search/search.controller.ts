import { SearchRequestDto, SearchResultResponseDto } from "@loom/dto";
import { Controller, Get, Query, SerializeOptions } from "@nestjs/common";
import { SearchService } from "./search.service";

// Every role may search: reading the CMS is open to anyone signed in
@Controller("admin/search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @SerializeOptions({ type: SearchResultResponseDto })
  @Get()
  search(@Query() query: SearchRequestDto): Promise<SearchResultResponseDto[]> {
    return this.searchService.search(query);
  }
}
